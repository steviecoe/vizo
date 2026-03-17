import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../services/firebase-admin';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { creditCostsSchema } from '@vizo/shared';

export async function listTenantsHandler(request: CallableRequest) {
  requireAdmin(request);

  const db = getDb();
  const snapshot = await db
    .collection('tenants')
    .orderBy('createdAt', 'desc')
    .get();

  const tenants = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return { tenants };
}

export const listTenants = onCall(listTenantsHandler);

export async function getCreditCostsHandler(request: CallableRequest) {
  requireAdmin(request);

  const db = getDb();
  const doc = await db.doc('platform/config/global/settings').get();

  if (!doc.exists) {
    throw new HttpsError('not-found', 'Platform config not found. Run bootstrap first.');
  }

  return doc.data();
}

export const getCreditCosts = onCall(getCreditCostsHandler);

export async function updateCreditCostsHandler(request: CallableRequest) {
  requireAdmin(request);

  const parsed = creditCostsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  const adminUid = request.auth!.uid;

  await db.doc('platform/config/global/settings').update({
    creditCosts: parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid,
  });

  return { success: true, creditCosts: parsed.data };
}

export const updateCreditCosts = onCall(updateCreditCostsHandler);

// ─── Public config (tenant-accessible) ──────────────────────

export async function getPlatformPublicConfigHandler(request: CallableRequest) {
  requireAuth(request);

  const db = getDb();
  const doc = await db.doc('platform/config/global/settings').get();

  if (!doc.exists) {
    return { zendeskUrl: '' };
  }

  const data = doc.data()!;
  return { zendeskUrl: data.zendeskUrl || '' };
}

export const getPlatformPublicConfig = onCall(getPlatformPublicConfigHandler);
