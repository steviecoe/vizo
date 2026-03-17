import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { photoshootCreateSchema } from '@vizo/shared';
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
import { generateImage } from '../services/gemini-service';
import {
  computeScheduleTime,
  computePhotoshootImageCount,
  enqueuePhotoshootTask,
} from '../services/cloud-tasks';
import type { PhotoshootTaskPayload } from '../services/cloud-tasks';

// ─── Helpers ───────────────────────────────────────────────

function computeCreditCost(
  costs: CreditCosts,
  resolution: '1k' | '2k',
  imageCount: number,
): number {
  const perImage =
    resolution === '2k' ? costs.photoshoot2k : costs.photoshoot1k;
  return perImage * imageCount;
}

async function loadModels(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  ids: string[],
): Promise<ArtDirectionModel[]> {
  if (ids.length === 0) return [];
  const models: ArtDirectionModel[] = [];
  for (const id of ids) {
    const doc = await db.doc(`tenants/${tenantId}/artDirectionModels/${id}`).get();
    if (doc.exists) models.push({ id: doc.id, ...doc.data() } as ArtDirectionModel);
  }
  return models;
}

async function loadBackgrounds(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  ids: string[],
): Promise<ArtDirectionBackground[]> {
  if (ids.length === 0) return [];
  const bgs: ArtDirectionBackground[] = [];
  for (const id of ids) {
    const doc = await db.doc(`tenants/${tenantId}/artDirectionBackgrounds/${id}`).get();
    if (doc.exists) bgs.push({ id: doc.id, ...doc.data() } as ArtDirectionBackground);
  }
  return bgs;
}

async function loadProducts(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  ids: string[],
): Promise<ShopifyProduct[]> {
  if (ids.length === 0) return [];
  const products: ShopifyProduct[] = [];
  for (const id of ids) {
    const doc = await db.doc(`tenants/${tenantId}/products/${id}`).get();
    if (doc.exists) products.push({ id: doc.id, ...doc.data() } as ShopifyProduct);
  }
  return products;
}

// ─── Create Photoshoot Handler ─────────────────────────────

export async function createPhotoshootHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const uid = request.auth!.uid;

  // 1. Validate input
  const parsed = photoshootCreateSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const input = parsed.data;
  const db = getDb();

  // 2. Load platform config for credit costs
  const configDoc = await db.doc('platform/config/global/settings').get();
  if (!configDoc.exists) {
    throw new HttpsError('internal', 'Platform config not found');
  }

  const creditCosts = configDoc.data()!.creditCosts as CreditCosts;

  // 3. Compute total image count and credit cost
  const totalImages = computePhotoshootImageCount(
    input.modelIds.length,
    input.backgroundIds.length,
    Math.max(input.productIds.length + input.itemImageUrls.length, 1),
    input.variantCount,
  );

  const totalCost = computeCreditCost(creditCosts, input.resolution, totalImages);

  // 4. Compute schedule time
  const scheduledFor = computeScheduleTime(input.isOvernight);

  // 5. Create photoshoot document
  const now = new Date().toISOString();
  const photoshootRef = db.collection(`tenants/${tenantId}/photoshoots`).doc();

  await photoshootRef.set({
    name: input.name,
    status: input.isOvernight ? 'scheduled' : 'processing',
    modelIds: input.modelIds,
    backgroundIds: input.backgroundIds,
    productIds: input.productIds,
    itemImageUrls: input.itemImageUrls,
    resolution: input.resolution,
    aspectRatio: input.aspectRatio,
    variantCount: input.variantCount,
    brief: input.brief,
    isOvernight: input.isOvernight,
    scheduledFor,
    jobIds: [],
    totalCreditsEstimate: totalCost,
    createdAt: now,
    createdBy: uid,
  });

  // 6. RESERVE credits atomically upfront (Commit-or-Refund)
  let ledgerEntryId: string;
  try {
    ledgerEntryId = await reserveCredits(
      tenantId,
      totalCost,
      'debit_photoshoot',
      `Photoshoot "${input.name}": ${totalImages} image(s) at ${input.resolution}`,
      photoshootRef.id,
      uid,
    );
  } catch (error) {
    await photoshootRef.update({ status: 'completed' });
    const message = error instanceof Error ? error.message : 'Credit reservation failed';
    throw new HttpsError('failed-precondition', message);
  }

  // 7. Enqueue Cloud Task (possibly deferred for overnight)
  const taskName = await enqueuePhotoshootTask(
    {
      photoshootId: photoshootRef.id,
      tenantId,
      createdBy: uid,
    },
    scheduledFor,
  );

  return {
    photoshootId: photoshootRef.id,
    status: input.isOvernight ? 'scheduled' : 'processing',
    scheduledFor,
    totalImages,
    totalCreditsEstimate: totalCost,
    ledgerEntryId,
    taskName,
  };
}

// ─── Process Photoshoot Worker ─────────────────────────────

/**
 * The photoshoot worker: processes all model × background × product combinations.
 * Called by Cloud Tasks (HTTP). Implements Commit-or-Refund for bulk failures.
 *
 * Flow:
 * 1. Load photoshoot doc + tenant art direction
 * 2. Load all referenced models, backgrounds, products
 * 3. For each (model × background × product) combo, create a generation job
 * 4. Generate images (variantCount per combo)
 * 5. Track completions + failures
 * 6. Refund credits proportionally for any failed images
 */
export async function processPhotoshootWorker(
  payload: PhotoshootTaskPayload,
): Promise<{ completedImages: number; failedImages: number }> {
  const { photoshootId, tenantId, createdBy } = payload;
  const db = getDb();

  // 1. Load photoshoot
  const photoshootRef = db.doc(`tenants/${tenantId}/photoshoots/${photoshootId}`);
  const photoshootDoc = await photoshootRef.get();
  if (!photoshootDoc.exists) {
    throw new Error(`Photoshoot ${photoshootId} not found`);
  }

  const photoshoot = photoshootDoc.data()!;
  await photoshootRef.update({ status: 'processing' });

  // 2. Load tenant for art direction
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  const tenantArtDirection = (tenantDoc.data()?.artDirection || {}) as TenantArtDirection;

  // 3. Load assets
  const [models, backgrounds, products] = await Promise.all([
    loadModels(db, tenantId, photoshoot.modelIds),
    loadBackgrounds(db, tenantId, photoshoot.backgroundIds),
    loadProducts(db, tenantId, photoshoot.productIds),
  ]);

  // 4. Build combinations: model × background × product
  const effectiveModels = models.length > 0 ? models : [null];
  const effectiveBackgrounds = backgrounds.length > 0 ? backgrounds : [null];
  const effectiveProducts = products.length > 0 ? products : [null];

  let totalCompleted = 0;
  let totalFailed = 0;
  const jobIds: string[] = [];

  for (const model of effectiveModels) {
    for (const background of effectiveBackgrounds) {
      for (const product of effectiveProducts) {
        // Create a generation job for this combination
        const jobRef = db.collection(`tenants/${tenantId}/generationJobs`).doc();
        const jobNow = new Date().toISOString();

        await jobRef.set({
          type: 'photoshoot',
          status: 'processing',
          params: {
            resolution: photoshoot.resolution,
            aspectRatio: photoshoot.aspectRatio,
            variantCount: photoshoot.variantCount,
            brief: photoshoot.brief,
            modelIds: model ? [model.id] : [],
            backgroundIds: background ? [background.id] : [],
            productIds: product ? [product.id] : [],
            itemImageUrls: photoshoot.itemImageUrls || [],
          },
          isOvernight: photoshoot.isOvernight,
          scheduledFor: photoshoot.scheduledFor,
          creditsCost: 0, // tracked at photoshoot level
          creditsRefunded: 0,
          totalImages: photoshoot.variantCount,
          completedImages: 0,
          failedImages: 0,
          createdAt: jobNow,
          createdBy,
          completedAt: null,
        });

        jobIds.push(jobRef.id);

        // Assemble prompt for this combination
        const assembled = assemblePrompt({
          flowType: 'photoshoot',
          resolution: photoshoot.resolution,
          aspectRatio: photoshoot.aspectRatio,
          tenantArtDirection,
          models: model ? [model] : [],
          backgrounds: background ? [background] : [],
          products: product ? [product] : [],
          itemImageUrls: photoshoot.itemImageUrls || [],
          userBrief: photoshoot.brief,
        });

        // Generate variants
        let jobCompleted = 0;
        let jobFailed = 0;

        for (let i = 0; i < photoshoot.variantCount; i++) {
          try {
            const result = await generateImage({
              textPrompt: assembled.textPrompt,
              imageUrls: assembled.imageUrls,
              tenantId,
            });

            const imageId = db.collection(`tenants/${tenantId}/generatedImages`).doc().id;
            const storagePath = `tenants/${tenantId}/generated/${jobRef.id}/${imageId}.png`;

            const bucket = getStorage().bucket();
            const file = bucket.file(storagePath);
            await file.save(Buffer.from(result.imageBase64, 'base64'), {
              metadata: { contentType: result.mimeType || 'image/png' },
            });

            const imageNow = new Date().toISOString();
            await db.collection(`tenants/${tenantId}/generatedImages`).doc(imageId).set({
              jobId: jobRef.id,
              photoshootId,
              status: 'waiting_approval',
              storageUrl: storagePath,
              thumbnailUrl: storagePath,
              resolution: photoshoot.resolution,
              aspectRatio: photoshoot.aspectRatio,
              modelId: model?.id || null,
              backgroundId: background?.id || null,
              productId: product?.id || null,
              shopifyExportStatus: null,
              shopifyImageId: null,
              promptUsed: assembled.textPrompt.slice(0, 2000),
              creditsCharged: 0,
              generatedAt: imageNow,
              reviewedAt: null,
              reviewedBy: null,
              createdAt: imageNow,
            });

            jobCompleted++;
          } catch {
            jobFailed++;
          }
        }

        // Finalize this job
        const jobFinalNow = new Date().toISOString();
        await jobRef.update({
          status: jobCompleted > 0 ? 'completed' : 'failed',
          completedImages: jobCompleted,
          failedImages: jobFailed,
          completedAt: jobFinalNow,
        });

        totalCompleted += jobCompleted;
        totalFailed += jobFailed;

        // Update photoshoot progress
        await photoshootRef.update({ jobIds });
      }
    }
  }

  // 5. Finalize photoshoot
  const finalNow = new Date().toISOString();
  const finalStatus = totalCompleted > 0 ? 'completed' : 'completed';
  await photoshootRef.update({
    status: finalStatus,
    jobIds,
    completedAt: finalNow,
  });

  // 6. REFUND credits for failed images (Commit-or-Refund)
  if (totalFailed > 0) {
    const totalImages = totalCompleted + totalFailed;
    const totalCost = photoshoot.totalCreditsEstimate as number;
    const refundAmount = Math.round((totalCost / totalImages) * totalFailed);

    if (refundAmount > 0) {
      await refundCreditsForFailure(tenantId, refundAmount, photoshootId, 'system');
    }
  }

  return { completedImages: totalCompleted, failedImages: totalFailed };
}

// ─── HTTP Handler for Cloud Tasks ──────────────────────────

async function processPhotoshootHttpHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = req.body as PhotoshootTaskPayload;

    if (!payload.photoshootId || !payload.tenantId) {
      res.status(400).json({ error: 'Missing photoshootId or tenantId' });
      return;
    }

    const result = await processPhotoshootWorker(payload);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worker failed';
    res.status(500).json({ error: message });
  }
}

// ─── List Photoshoots Handler ──────────────────────────────

export async function listPhotoshootsHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const db = getDb();

  const snapshot = await db
    .collection(`tenants/${tenantId}/photoshoots`)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const photoshoots = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return { photoshoots };
}

// ─── Exports ───────────────────────────────────────────────

export const createPhotoshoot = onCall(
  { timeoutSeconds: 60, region: 'europe-west4' },
  createPhotoshootHandler,
);

export const processPhotoshoot = onRequest(
  { timeoutSeconds: 540, region: 'europe-west4' },
  processPhotoshootHttpHandler,
);
