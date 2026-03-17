import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { getDb } from '../services/firebase-admin';

// ─── List Images ──────────────────────────────────────────

export async function listImagesHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const { statusFilter } = request.data as { statusFilter?: string };
  const db = getDb();

  let query: FirebaseFirestore.Query = db
    .collection(`tenants/${tenantId}/generatedImages`)
    .orderBy('createdAt', 'desc');

  if (statusFilter && statusFilter !== 'all') {
    query = query.where('status', '==', statusFilter);
  }

  const snapshot = await query.limit(200).get();
  const images = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return { images };
}

export const listImages = onCall(listImagesHandler);

// ─── Update Image Status ─────────────────────────────────

export async function updateImageStatusHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const { imageIds, status } = request.data as {
    imageIds: string[];
    status: 'approved' | 'rejected';
  };

  if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
    throw new HttpsError('invalid-argument', 'imageIds must be a non-empty array');
  }

  if (!['approved', 'rejected'].includes(status)) {
    throw new HttpsError('invalid-argument', 'status must be "approved" or "rejected"');
  }

  const db = getDb();
  const imagesRef = db.collection(`tenants/${tenantId}/generatedImages`);
  const now = new Date().toISOString();

  // Batch update (max 500 per batch)
  const BATCH_LIMIT = 500;
  let batch = db.batch();
  let opCount = 0;

  for (const imageId of imageIds) {
    batch.update(imagesRef.doc(imageId), {
      status,
      reviewedAt: now,
      reviewedBy: request.auth!.uid,
    });
    opCount++;

    if (opCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  return { success: true, updated: imageIds.length };
}

export const updateImageStatus = onCall(updateImageStatusHandler);
