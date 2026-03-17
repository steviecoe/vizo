import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import type {
  ArtDirectionModel,
  ArtDirectionBackground,
  ShopifyProduct,
  TenantArtDirection,
  CreditCosts,
} from '@vizo/shared';
import { requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { getDb, getStorage } from '../services/firebase-admin';
import { reserveCredits, refundCreditsForFailure } from '../services/credit-service';
import { assemblePrompt } from '../generation/prompt-orchestrator';
import { generateWithFallback } from '../services/generation-router';

// ─── Schema ────────────────────────────────────────────────

const regenerateSchema = z.object({
  imageId: z.string().min(1),
});

// ─── Handler ───────────────────────────────────────────────

/**
 * Regenerates an image using its original job parameters.
 *
 * Flow:
 * 1. Load the original image and its parent generation job
 * 2. Compute credit cost using current platform pricing
 * 3. Reserve credits atomically (Commit-or-Refund)
 * 4. Re-run the prompt orchestrator + Gemini generation
 * 5. Store the new image, mark old one as 'rejected'
 * 6. Refund on failure
 */
export async function regenerateImageHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const uid = request.auth!.uid;

  const parsed = regenerateSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const { imageId } = parsed.data;
  const db = getDb();

  // 1. Load original image
  const imageDoc = await db
    .doc(`tenants/${tenantId}/generatedImages/${imageId}`)
    .get();

  if (!imageDoc.exists) {
    throw new HttpsError('not-found', 'Image not found');
  }

  const originalImage = imageDoc.data()!;

  if (originalImage.status === 'waiting_approval') {
    throw new HttpsError(
      'failed-precondition',
      'Cannot regenerate images that are still waiting approval',
    );
  }

  // 2. Load the parent job for original params
  const jobDoc = await db
    .doc(`tenants/${tenantId}/generationJobs/${originalImage.jobId}`)
    .get();

  if (!jobDoc.exists) {
    throw new HttpsError('not-found', 'Original generation job not found');
  }

  const job = jobDoc.data()!;
  const params = job.params;

  // 3. Load platform config for credit costs
  const configDoc = await db.doc('platform/config/global/settings').get();
  if (!configDoc.exists) {
    throw new HttpsError('internal', 'Platform config not found');
  }

  const creditCosts = configDoc.data()!.creditCosts as CreditCosts;
  const flowType = job.type as 'quick' | 'shopify' | 'photoshoot';
  const costMap: Record<string, number> = {
    quick_1k: creditCosts.quickGen1k,
    quick_2k: creditCosts.quickGen2k,
    shopify_1k: creditCosts.shopifyGen1k,
    shopify_2k: creditCosts.shopifyGen2k,
    photoshoot_1k: creditCosts.photoshoot1k,
    photoshoot_2k: creditCosts.photoshoot2k,
  };
  const perImageCost = costMap[`${flowType}_${params.resolution}`] ?? creditCosts.quickGen1k;

  // 4. Reserve credits for 1 image
  const now = new Date().toISOString();
  const regenJobRef = db.collection(`tenants/${tenantId}/generationJobs`).doc();

  await regenJobRef.set({
    type: flowType,
    status: 'processing',
    params,
    isOvernight: false,
    scheduledFor: null,
    creditsCost: perImageCost,
    creditsRefunded: 0,
    totalImages: 1,
    completedImages: 0,
    failedImages: 0,
    createdAt: now,
    createdBy: uid,
    completedAt: null,
    regeneratedFrom: imageId,
  });

  try {
    await reserveCredits(
      tenantId,
      perImageCost,
      'debit_generation',
      `Regeneration of image ${imageId}`,
      regenJobRef.id,
      uid,
    );
  } catch (error) {
    await regenJobRef.update({ status: 'failed', completedAt: now });
    const message = error instanceof Error ? error.message : 'Credit reservation failed';
    throw new HttpsError('failed-precondition', message);
  }

  // 5. Load art direction assets
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  const tenantArtDirection = (tenantDoc.data()?.artDirection || {}) as TenantArtDirection;

  const loadModels = async (ids: string[]): Promise<ArtDirectionModel[]> => {
    const models: ArtDirectionModel[] = [];
    for (const id of ids) {
      const doc = await db.doc(`tenants/${tenantId}/artDirectionModels/${id}`).get();
      if (doc.exists) models.push({ id: doc.id, ...doc.data() } as ArtDirectionModel);
    }
    return models;
  };

  const loadBackgrounds = async (ids: string[]): Promise<ArtDirectionBackground[]> => {
    const bgs: ArtDirectionBackground[] = [];
    for (const id of ids) {
      const doc = await db.doc(`tenants/${tenantId}/artDirectionBackgrounds/${id}`).get();
      if (doc.exists) bgs.push({ id: doc.id, ...doc.data() } as ArtDirectionBackground);
    }
    return bgs;
  };

  const loadProducts = async (ids: string[]): Promise<ShopifyProduct[]> => {
    const products: ShopifyProduct[] = [];
    for (const id of ids) {
      const doc = await db.doc(`tenants/${tenantId}/products/${id}`).get();
      if (doc.exists) products.push({ id: doc.id, ...doc.data() } as ShopifyProduct);
    }
    return products;
  };

  const [models, backgrounds, products] = await Promise.all([
    loadModels(params.modelIds || []),
    loadBackgrounds(params.backgroundIds || []),
    loadProducts(params.productIds || []),
  ]);

  // 6. Assemble prompt + generate
  const assembled = assemblePrompt({
    flowType,
    resolution: params.resolution,
    aspectRatio: params.aspectRatio,
    tenantArtDirection,
    models,
    backgrounds,
    products,
    itemImageUrls: params.itemImageUrls || [],
    userBrief: params.brief,
  });

  try {
    const result = await generateWithFallback({
      textPrompt: assembled.textPrompt,
      imageUrls: assembled.imageUrls,
      tenantId,
    });

    // 7. Store new image
    const newImageId = db.collection(`tenants/${tenantId}/generatedImages`).doc().id;
    const storagePath = `tenants/${tenantId}/generated/${regenJobRef.id}/${newImageId}.png`;

    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    await file.save(Buffer.from(result.imageBase64, 'base64'), {
      metadata: { contentType: result.mimeType || 'image/png' },
    });

    const imageNow = new Date().toISOString();
    await db.collection(`tenants/${tenantId}/generatedImages`).doc(newImageId).set({
      jobId: regenJobRef.id,
      status: 'waiting_approval',
      storageUrl: storagePath,
      thumbnailUrl: storagePath,
      resolution: params.resolution,
      aspectRatio: params.aspectRatio,
      modelId: originalImage.modelId || null,
      backgroundId: originalImage.backgroundId || null,
      productId: originalImage.productId || null,
      shopifyExportStatus: null,
      shopifyImageId: null,
      promptUsed: assembled.textPrompt.slice(0, 2000),
      creditsCharged: perImageCost,
      generatedAt: imageNow,
      reviewedAt: null,
      reviewedBy: null,
      createdAt: imageNow,
      aiModelUsed: result.modelUsed,
      regeneratedFrom: imageId,
    });

    // 8. Finalize job
    await regenJobRef.update({
      status: 'completed',
      completedImages: 1,
      completedAt: imageNow,
    });

    return {
      newImageId,
      jobId: regenJobRef.id,
      creditsCost: perImageCost,
      status: 'completed',
    };
  } catch (error) {
    // Refund on failure
    const failNow = new Date().toISOString();
    await regenJobRef.update({
      status: 'failed',
      failedImages: 1,
      completedAt: failNow,
    });
    await refundCreditsForFailure(tenantId, perImageCost, regenJobRef.id, uid);
    await regenJobRef.update({ creditsRefunded: perImageCost });

    const message = error instanceof Error ? error.message : 'Regeneration failed';
    throw new HttpsError('internal', `Regeneration failed: ${message}. Credits refunded.`);
  }
}

// ─── Export ────────────────────────────────────────────────

export const regenerateImage = onCall(
  { timeoutSeconds: 300, region: 'europe-west4' },
  regenerateImageHandler,
);
