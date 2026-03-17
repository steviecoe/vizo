import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAuth, resolveEffectiveTenantId } from '../_lib/auth';
import { ApiError } from '../_lib/errors';
import { getDb } from '../_lib/admin';

async function listImages({ claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { statusFilter } = (data || {}) as { statusFilter?: string };
  const db = getDb();

  let query: FirebaseFirestore.Query = db
    .collection(`tenants/${tenantId}/generatedImages`)
    .orderBy('createdAt', 'desc');

  if (statusFilter && statusFilter !== 'all') {
    query = query.where('status', '==', statusFilter);
  }

  const snapshot = await query.limit(200).get();
  return { images: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
}

async function updateImageStatus({ uid, claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { imageIds, status } = data as { imageIds: string[]; status: string };

  if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
    throw new ApiError('invalid-argument', 'imageIds must be a non-empty array');
  }
  if (!['approved', 'rejected'].includes(status)) {
    throw new ApiError('invalid-argument', 'status must be "approved" or "rejected"');
  }

  const db = getDb();
  const imagesRef = db.collection(`tenants/${tenantId}/generatedImages`);
  const now = new Date().toISOString();

  const BATCH_LIMIT = 500;
  let batch = db.batch();
  let opCount = 0;

  for (const imageId of imageIds) {
    batch.update(imagesRef.doc(imageId), { status, reviewedAt: now, reviewedBy: uid });
    opCount++;
    if (opCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }
  if (opCount > 0) await batch.commit();

  return { success: true, updated: imageIds.length };
}

export const POST = createRouteHandler({ listImages, updateImageStatus });
