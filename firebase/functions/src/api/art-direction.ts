import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { artDirectionModelSchema, artDirectionBackgroundSchema } from '@vizo/shared';
import { requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { getDb } from '../services/firebase-admin';

// ─── Models ───────────────────────────────────────────────

export async function listModelsHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const snapshot = await db
    .collection(`tenants/${tenantId}/artDirectionModels`)
    .orderBy('createdAt', 'desc')
    .get();

  return {
    models: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

export const listModels = onCall(listModelsHandler);

export async function createModelHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const parsed = artDirectionModelSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  const now = new Date().toISOString();
  const docRef = await db
    .collection(`tenants/${tenantId}/artDirectionModels`)
    .add({
      ...parsed.data,
      referenceImageUrl: null,
      generatedAt: null,
      createdAt: now,
      createdBy: request.auth!.uid,
    });

  return { id: docRef.id, ...parsed.data };
}

export const createModel = onCall(createModelHandler);

export async function updateModelHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const { id, ...data } = request.data as { id: string } & Record<string, unknown>;
  if (!id) {
    throw new HttpsError('invalid-argument', 'Model id is required');
  }

  const parsed = artDirectionModelSchema.safeParse(data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  await db.doc(`tenants/${tenantId}/artDirectionModels/${id}`).update({
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, id };
}

export const updateModel = onCall(updateModelHandler);

export async function deleteModelHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const { id } = request.data as { id: string };
  if (!id) {
    throw new HttpsError('invalid-argument', 'Model id is required');
  }

  const db = getDb();
  await db.doc(`tenants/${tenantId}/artDirectionModels/${id}`).delete();

  return { success: true };
}

export const deleteModel = onCall(deleteModelHandler);

// ─── Backgrounds ──────────────────────────────────────────

export async function listBackgroundsHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const snapshot = await db
    .collection(`tenants/${tenantId}/artDirectionBackgrounds`)
    .orderBy('createdAt', 'desc')
    .get();

  return {
    backgrounds: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

export const listBackgrounds = onCall(listBackgroundsHandler);

export async function createBackgroundHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const parsed = artDirectionBackgroundSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  const now = new Date().toISOString();
  const docRef = await db
    .collection(`tenants/${tenantId}/artDirectionBackgrounds`)
    .add({
      ...parsed.data,
      referenceImageUrl: null,
      generatedAt: null,
      createdAt: now,
      createdBy: request.auth!.uid,
    });

  return { id: docRef.id, ...parsed.data };
}

export const createBackground = onCall(createBackgroundHandler);

export async function updateBackgroundHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const { id, ...data } = request.data as { id: string } & Record<string, unknown>;
  if (!id) {
    throw new HttpsError('invalid-argument', 'Background id is required');
  }

  const parsed = artDirectionBackgroundSchema.safeParse(data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  await db.doc(`tenants/${tenantId}/artDirectionBackgrounds/${id}`).update({
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, id };
}

export const updateBackground = onCall(updateBackgroundHandler);

export async function deleteBackgroundHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const { id } = request.data as { id: string };
  if (!id) {
    throw new HttpsError('invalid-argument', 'Background id is required');
  }

  const db = getDb();
  await db.doc(`tenants/${tenantId}/artDirectionBackgrounds/${id}`).delete();

  return { success: true };
}

export const deleteBackground = onCall(deleteBackgroundHandler);
