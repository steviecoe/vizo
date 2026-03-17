import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { videoGenerateSchema } from '@vizo/shared';
import type { CreditCosts } from '@vizo/shared';
import { requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { getDb, getStorage } from '../services/firebase-admin';
import { reserveCredits, refundCreditsForFailure } from '../services/credit-service';
import { generateVideo } from '../services/veo-service';

// ─── Generate Video from Approved Image ────────────────────

export async function generateVideoHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const uid = request.auth!.uid;

  // 1. Validate input
  const parsed = videoGenerateSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const { imageId } = parsed.data;
  const db = getDb();

  // 2. Load the source image
  const imageDoc = await db.doc(`tenants/${tenantId}/generatedImages/${imageId}`).get();
  if (!imageDoc.exists) {
    throw new HttpsError('not-found', 'Image not found');
  }

  const imageData = imageDoc.data()!;
  if (imageData.status !== 'approved') {
    throw new HttpsError('failed-precondition', 'Only approved images can be converted to video');
  }

  // 3. Load credit costs
  const configDoc = await db.doc('platform/config/global/settings').get();
  if (!configDoc.exists) {
    throw new HttpsError('internal', 'Platform config not found');
  }

  const creditCosts = configDoc.data()!.creditCosts as CreditCosts;
  const videoCost = creditCosts.videoGeneration;

  // 4. Create video document
  const now = new Date().toISOString();
  const videoRef = db.collection(`tenants/${tenantId}/generatedVideos`).doc();
  await videoRef.set({
    sourceImageId: imageId,
    status: 'pending',
    storageUrl: null,
    thumbnailUrl: null,
    durationSeconds: 0,
    creditsCharged: videoCost,
    createdAt: now,
    createdBy: uid,
    completedAt: null,
    errorMessage: null,
  });

  // 5. Reserve credits
  let ledgerEntryId: string;
  try {
    ledgerEntryId = await reserveCredits(
      tenantId,
      videoCost,
      'debit_video',
      `Video generation from image ${imageId}`,
      videoRef.id,
      uid,
    );
  } catch (error) {
    await videoRef.update({ status: 'failed', completedAt: now, errorMessage: 'Insufficient credits' });
    const message = error instanceof Error ? error.message : 'Credit reservation failed';
    throw new HttpsError('failed-precondition', message);
  }

  // 6. Download source image from Storage
  const bucket = getStorage().bucket();
  const file = bucket.file(imageData.storageUrl);
  const [imageBuffer] = await file.download();
  const imageBase64 = imageBuffer.toString('base64');

  // 7. Generate video
  await videoRef.update({ status: 'processing' });

  try {
    const result = await generateVideo({
      imageBase64,
      imageMimeType: 'image/png',
      tenantId,
    });

    // 8. Store video in Firebase Storage
    const videoStoragePath = `tenants/${tenantId}/videos/${videoRef.id}.mp4`;
    const videoFile = bucket.file(videoStoragePath);
    await videoFile.save(Buffer.from(result.videoBase64, 'base64'), {
      metadata: { contentType: result.mimeType },
    });

    // 9. Update video document
    const completedNow = new Date().toISOString();
    await videoRef.update({
      status: 'completed',
      storageUrl: videoStoragePath,
      thumbnailUrl: imageData.storageUrl, // Use source image as thumbnail
      durationSeconds: result.durationSeconds,
      completedAt: completedNow,
    });

    return {
      videoId: videoRef.id,
      status: 'completed',
      creditsCost: videoCost,
      durationSeconds: result.durationSeconds,
      ledgerEntryId,
    };
  } catch (error) {
    // Refund credits on failure
    const refundId = await refundCreditsForFailure(tenantId, videoCost, videoRef.id, uid);
    const errorMessage = error instanceof Error ? error.message : 'Video generation failed';
    await videoRef.update({
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage,
    });

    return {
      videoId: videoRef.id,
      status: 'failed',
      creditsCost: videoCost,
      creditsRefunded: videoCost,
      error: errorMessage,
      refundLedgerEntryId: refundId,
      ledgerEntryId,
    };
  }
}

export const generateVideoFromImage = onCall(
  { timeoutSeconds: 300, region: 'europe-west4' },
  generateVideoHandler,
);
