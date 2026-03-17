import { creditCostsSchema } from '@vizo/shared';
import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAuth, requireAdmin } from '../_lib/auth';
import { ApiError } from '../_lib/errors';
import { getDb, getAuth } from '../_lib/admin';

async function listTenants({ claims }: ActionContext) {
  requireAdmin(claims);

  const db = getDb();
  const snapshot = await db.collection('tenants').orderBy('createdAt', 'desc').get();
  return { tenants: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
}

async function getCreditCosts({ claims }: ActionContext) {
  requireAdmin(claims);

  const db = getDb();
  const doc = await db.doc('platform/config/global/settings').get();
  if (!doc.exists) {
    throw new ApiError('not-found', 'Platform config not found. Run bootstrap first.');
  }

  return doc.data();
}

async function updateCreditCosts({ uid, claims, data }: ActionContext) {
  requireAdmin(claims);

  const parsed = creditCostsSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  await db.doc('platform/config/global/settings').update({
    creditCosts: parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  });

  return { success: true, creditCosts: parsed.data };
}

async function getPlatformPublicConfig({ claims }: ActionContext) {
  requireAuth(claims);

  const db = getDb();
  const doc = await db.doc('platform/config/global/settings').get();
  if (!doc.exists) return { zendeskUrl: '' };

  const data = doc.data()!;
  return { zendeskUrl: data.zendeskUrl || '' };
}

async function listAdmins({ claims }: ActionContext) {
  requireAdmin(claims);

  const db = getDb();
  const snapshot = await db.collection('admins').orderBy('createdAt', 'desc').get();
  return { admins: snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })) };
}

async function addAdmin({ uid, claims, data }: ActionContext) {
  requireAdmin(claims);

  const { email } = data as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError('invalid-argument', 'Valid email is required');
  }

  const db = getDb();
  const auth = getAuth();

  // Check if already an admin
  const existing = await db.collection('admins').where('email', '==', email.toLowerCase()).limit(1).get();
  if (!existing.empty) {
    throw new ApiError('already-exists', 'This user is already a superadmin');
  }

  // Find or create the Firebase Auth user
  let targetUid: string;
  try {
    const userRecord = await auth.getUserByEmail(email);
    targetUid = userRecord.uid;
  } catch {
    const userRecord = await auth.createUser({ email });
    targetUid = userRecord.uid;
  }

  // Set admin custom claims
  await auth.setCustomUserClaims(targetUid, { role: 'vg_admin' });

  // Create admin record
  await db.doc(`admins/${targetUid}`).set({
    email: email.toLowerCase(),
    displayName: email.split('@')[0],
    createdAt: new Date().toISOString(),
    addedBy: uid,
  });

  return { success: true, uid: targetUid, email };
}

async function removeAdmin({ uid, claims, data }: ActionContext) {
  requireAdmin(claims);

  const { targetUid } = data as { targetUid?: string };
  if (!targetUid) throw new ApiError('invalid-argument', 'targetUid is required');
  if (targetUid === uid) throw new ApiError('invalid-argument', 'You cannot remove yourself');

  const db = getDb();
  const auth = getAuth();

  const adminDoc = await db.doc(`admins/${targetUid}`).get();
  if (!adminDoc.exists) throw new ApiError('not-found', 'Admin not found');

  await db.doc(`admins/${targetUid}`).delete();
  try { await auth.setCustomUserClaims(targetUid, {}); } catch { /* user may be deleted */ }

  return { success: true };
}

export const POST = createRouteHandler({
  listTenants,
  getCreditCosts,
  updateCreditCosts,
  getPlatformPublicConfig,
  listAdmins,
  addAdmin,
  removeAdmin,
});
