import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { quickGenSchema } from '@vizo/shared';
import type {
  ArtDirectionModel,
  ArtDirectionBackground,
  ShopifyProduct,
  TenantArtDirection,
  CreditCosts,
} from '@vizo/shared';
import { requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { getDb } from '../services/firebase-admin';
import { getStorage } from '../services/firebase-admin';
import { reserveCredits, refundCreditsForFailure } from '../services/credit-service';
import { assemblePrompt } from '../generation/prompt-orchestrator';
import { generateWithFallback } from '../services/generation-router';

// ─── Helpers ───────────────────────────────────────────────

function computeCreditCost(
  costs: CreditCosts,
  flowType: 'quick' | 'shopify' | 'photoshoot',
  resolution: '1k' | '2k',
  variantCount: number,
): number {
  const costMap: Record<string, number> = {
    quick_1k: costs.quickGen1k,
    quick_2k: costs.quickGen2k,
    shopify_1k: costs.shopifyGen1k,
    shopify_2k: costs.shopifyGen2k,
    photoshoot_1k: costs.photoshoot1k,
    photoshoot_2k: costs.photoshoot2k,
  };

  const perImage = costMap[`${flowType}_${resolution}`] ?? costs.quickGen1k;
  return perImage * variantCount;
}

async function loadArtDirectionModels(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  modelIds: string[],
): Promise<ArtDirectionModel[]> {
  if (modelIds.length === 0) return [];

  const models: ArtDirectionModel[] = [];
  for (const id of modelIds) {
    const doc = await db.doc(`tenants/${tenantId}/artDirectionModels/${id}`).get();
    if (doc.exists) {
      models.push({ id: doc.id, ...doc.data() } as ArtDirectionModel);
    }
  }
  return models;
}

async function loadArtDirectionBackgrounds(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  backgroundIds: string[],
): Promise<ArtDirectionBackground[]> {
  if (backgroundIds.length === 0) return [];

  const backgrounds: ArtDirectionBackground[] = [];
  for (const id of backgroundIds) {
    const doc = await db.doc(`tenants/${tenantId}/artDirectionBackgrounds/${id}`).get();
    if (doc.exists) {
      backgrounds.push({ id: doc.id, ...doc.data() } as ArtDirectionBackground);
    }
  }
  return backgrounds;
}

async function loadProducts(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  productIds: string[],
): Promise<ShopifyProduct[]> {
  if (productIds.length === 0) return [];

  const products: ShopifyProduct[] = [];
  for (const id of productIds) {
    const doc = await db.doc(`tenants/${tenantId}/products/${id}`).get();
    if (doc.exists) {
      products.push({ id: doc.id, ...doc.data() } as ShopifyProduct);
    }
  }
  return products;
}

// ─── Quick Generate Handler ────────────────────────────────

export async function quickGenerateHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const uid = request.auth!.uid;

  // 1. Validate input
  const parsed = quickGenSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const { params } = parsed.data;
  const db = getDb();

  // 2. Load tenant + platform config for credit costs
  const [tenantDoc, configDoc] = await Promise.all([
    db.doc(`tenants/${tenantId}`).get(),
    db.doc('platform/config/global/settings').get(),
  ]);

  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Tenant not found');
  }

  const tenant = tenantDoc.data()!;
  const tenantArtDirection = (tenant.artDirection || {}) as TenantArtDirection;

  if (!configDoc.exists) {
    throw new HttpsError('internal', 'Platform config not found');
  }

  const creditCosts = configDoc.data()!.creditCosts as CreditCosts;
  const totalCost = computeCreditCost(
    creditCosts,
    'quick',
    params.resolution,
    params.variantCount,
  );

  // 3. Create generation job doc (status: pending)
  const now = new Date().toISOString();
  const jobRef = db.collection(`tenants/${tenantId}/generationJobs`).doc();
  await jobRef.set({
    type: 'quick',
    status: 'pending',
    params,
    isOvernight: false,
    scheduledFor: null,
    creditsCost: totalCost,
    creditsRefunded: 0,
    totalImages: params.variantCount,
    completedImages: 0,
    failedImages: 0,
    createdAt: now,
    createdBy: uid,
    completedAt: null,
  });

  // 4. RESERVE credits atomically (Commit-or-Refund: debit first)
  let ledgerEntryId: string;
  try {
    ledgerEntryId = await reserveCredits(
      tenantId,
      totalCost,
      'debit_generation',
      `Quick generation: ${params.variantCount} image(s) at ${params.resolution}`,
      jobRef.id,
      uid,
    );
  } catch (error) {
    // Insufficient credits — mark job as failed, do NOT proceed
    await jobRef.update({ status: 'failed', completedAt: now });
    const message = error instanceof Error ? error.message : 'Credit reservation failed';
    throw new HttpsError('failed-precondition', message);
  }

  // 5. Load art direction assets
  const [models, backgrounds, products] = await Promise.all([
    loadArtDirectionModels(db, tenantId, params.modelIds),
    loadArtDirectionBackgrounds(db, tenantId, params.backgroundIds),
    loadProducts(db, tenantId, params.productIds),
  ]);

  // 6. Assemble prompt via orchestrator
  const assembled = assemblePrompt({
    flowType: 'quick',
    resolution: params.resolution,
    aspectRatio: params.aspectRatio,
    tenantArtDirection,
    models,
    backgrounds,
    products,
    itemImageUrls: params.itemImageUrls,
    userBrief: params.brief,
  });

  // 7. Generate images (loop for variant count)
  await jobRef.update({ status: 'processing' });

  let completedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < params.variantCount; i++) {
    try {
      // Uses primary model (Gemini) with automatic fallback to secondary (Grok)
      const result = await generateWithFallback({
        textPrompt: assembled.textPrompt,
        imageUrls: assembled.imageUrls,
        tenantId,
      });

      // 8. Store generated image in Firebase Storage
      const imageId = db.collection(`tenants/${tenantId}/generatedImages`).doc().id;
      const storagePath = `tenants/${tenantId}/generated/${jobRef.id}/${imageId}.png`;

      const bucket = getStorage().bucket();
      const file = bucket.file(storagePath);
      await file.save(Buffer.from(result.imageBase64, 'base64'), {
        metadata: { contentType: result.mimeType || 'image/png' },
      });

      // 9. Create image document (tracks which AI model was used)
      const imageNow = new Date().toISOString();
      await db.collection(`tenants/${tenantId}/generatedImages`).doc(imageId).set({
        jobId: jobRef.id,
        status: 'waiting_approval',
        storageUrl: storagePath,
        thumbnailUrl: storagePath, // thumbnail generation deferred
        resolution: params.resolution,
        aspectRatio: params.aspectRatio,
        modelId: params.modelIds[0] || null,
        backgroundId: params.backgroundIds[0] || null,
        productId: params.productIds[0] || null,
        shopifyExportStatus: null,
        shopifyImageId: null,
        promptUsed: assembled.textPrompt.slice(0, 2000),
        creditsCharged: totalCost / params.variantCount,
        generatedAt: imageNow,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: imageNow,
        aiModelUsed: result.modelUsed,
      });

      completedCount++;
    } catch {
      failedCount++;
    }

    await jobRef.update({ completedImages: completedCount, failedImages: failedCount });
  }

  // 10. Finalize job
  const finalNow = new Date().toISOString();
  const finalStatus = completedCount > 0 ? 'completed' : 'failed';
  await jobRef.update({
    status: finalStatus,
    completedAt: finalNow,
    completedImages: completedCount,
    failedImages: failedCount,
  });

  // 11. REFUND credits for failed images (Commit-or-Refund: refund on failure)
  if (failedCount > 0 && completedCount < params.variantCount) {
    const refundAmount = Math.round(
      (totalCost / params.variantCount) * failedCount,
    );
    if (refundAmount > 0) {
      const refundId = await refundCreditsForFailure(
        tenantId,
        refundAmount,
        jobRef.id,
        uid,
      );
      await jobRef.update({ creditsRefunded: refundAmount });
      return {
        jobId: jobRef.id,
        status: finalStatus,
        completedImages: completedCount,
        failedImages: failedCount,
        creditsCost: totalCost,
        creditsRefunded: refundAmount,
        refundLedgerEntryId: refundId,
        ledgerEntryId,
      };
    }
  }

  return {
    jobId: jobRef.id,
    status: finalStatus,
    completedImages: completedCount,
    failedImages: failedCount,
    creditsCost: totalCost,
    creditsRefunded: 0,
    ledgerEntryId,
  };
}

export const quickGenerate = onCall(
  { timeoutSeconds: 300, region: 'europe-west4' },
  quickGenerateHandler,
);
