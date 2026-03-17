import { artDirectionModelSchema, artDirectionBackgroundSchema } from '@vizo/shared';
import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAuth, resolveEffectiveTenantId } from '../_lib/auth';
import { ApiError } from '../_lib/errors';
import { getDb } from '../_lib/admin';

// ─── Models ───────────────────────────────────────────────

async function listModels({ claims }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const snapshot = await db
    .collection(`tenants/${tenantId}/artDirectionModels`)
    .orderBy('createdAt', 'desc')
    .get();

  return { models: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
}

async function createModel({ uid, claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const parsed = artDirectionModelSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  const docRef = await db.collection(`tenants/${tenantId}/artDirectionModels`).add({
    ...parsed.data,
    referenceImageUrl: null,
    generatedAt: null,
    createdAt: new Date().toISOString(),
    createdBy: uid,
  });

  return { id: docRef.id, ...parsed.data };
}

async function updateModel({ claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { id, ...rest } = data as { id: string } & Record<string, unknown>;
  if (!id) throw new ApiError('invalid-argument', 'Model id is required');

  const parsed = artDirectionModelSchema.safeParse(rest);
  if (!parsed.success) {
    throw new ApiError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  await db.doc(`tenants/${tenantId}/artDirectionModels/${id}`).update({
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, id };
}

async function deleteModel({ claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { id } = data as { id: string };
  if (!id) throw new ApiError('invalid-argument', 'Model id is required');

  const db = getDb();
  await db.doc(`tenants/${tenantId}/artDirectionModels/${id}`).delete();

  return { success: true };
}

// ─── Backgrounds ──────────────────────────────────────────

async function listBackgrounds({ claims }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const snapshot = await db
    .collection(`tenants/${tenantId}/artDirectionBackgrounds`)
    .orderBy('createdAt', 'desc')
    .get();

  return { backgrounds: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
}

async function createBackground({ uid, claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const parsed = artDirectionBackgroundSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  const docRef = await db.collection(`tenants/${tenantId}/artDirectionBackgrounds`).add({
    ...parsed.data,
    referenceImageUrl: null,
    generatedAt: null,
    createdAt: new Date().toISOString(),
    createdBy: uid,
  });

  return { id: docRef.id, ...parsed.data };
}

async function updateBackground({ claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { id, ...rest } = data as { id: string } & Record<string, unknown>;
  if (!id) throw new ApiError('invalid-argument', 'Background id is required');

  const parsed = artDirectionBackgroundSchema.safeParse(rest);
  if (!parsed.success) {
    throw new ApiError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  await db.doc(`tenants/${tenantId}/artDirectionBackgrounds/${id}`).update({
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, id };
}

async function deleteBackground({ claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { id } = data as { id: string };
  if (!id) throw new ApiError('invalid-argument', 'Background id is required');

  const db = getDb();
  await db.doc(`tenants/${tenantId}/artDirectionBackgrounds/${id}`).delete();

  return { success: true };
}

export const POST = createRouteHandler({
  listModels,
  createModel,
  updateModel,
  deleteModel,
  listBackgrounds,
  createBackground,
  updateBackground,
  deleteBackground,
});
