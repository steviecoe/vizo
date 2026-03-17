import { createTenantSchema, updateTenantSchema, LOW_CREDIT_THRESHOLD_DEFAULT } from '@vizo/shared';
import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAdmin } from '../_lib/auth';
import { ApiError } from '../_lib/errors';
import { getDb, getAuth } from '../_lib/admin';
import { createOrUpdateSecret, buildTenantGeminiSecretName } from '../_lib/services/secret-manager';

async function createTenant({ uid, claims, data }: ActionContext) {
  requireAdmin(claims);

  const parsed = createTenantSchema.safeParse(data);
  if (!parsed.success) throw new ApiError('invalid-argument', parsed.error.message);

  const input = parsed.data;
  const db = getDb();
  const auth = getAuth();

  const existing = await db.collection('tenants').where('slug', '==', input.slug).limit(1).get();
  if (!existing.empty) {
    throw new ApiError('already-exists', `Tenant with slug "${input.slug}" already exists`);
  }

  const tenantRef = db.collection('tenants').doc();
  const tenantId = tenantRef.id;

  await createOrUpdateSecret(buildTenantGeminiSecretName(tenantId), input.geminiApiKey);

  await tenantRef.set({
    name: input.name,
    slug: input.slug,
    pricePerCredit: input.pricePerCredit,
    creditBalance: 0,
    lowCreditThreshold: LOW_CREDIT_THRESHOLD_DEFAULT,
    allowedFeatures: input.allowedFeatures,
    artDirection: {
      defaultBrief: input.artDirection?.defaultBrief || '',
      quickGenBrief: input.artDirection?.quickGenBrief || '',
      shopifyGenBrief: input.artDirection?.shopifyGenBrief || '',
      photoshootBrief: input.artDirection?.photoshootBrief || '',
    },
    shopify: { storeDomain: null, connectedAt: null, lastSyncAt: null },
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: uid,
    updatedAt: new Date().toISOString(),
  });

  for (const email of input.adminEmails) {
    let userUid: string;
    try {
      const userRecord = await auth.getUserByEmail(email);
      userUid = userRecord.uid;
    } catch {
      const userRecord = await auth.createUser({ email });
      userUid = userRecord.uid;
    }

    await auth.setCustomUserClaims(userUid, { role: 'tenant_admin', tenantId });
    await db.doc(`tenants/${tenantId}/users/${userUid}`).set({
      email,
      displayName: email.split('@')[0],
      role: 'tenant_admin',
      invitedBy: uid,
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  }

  return {
    success: true,
    tenantId,
    message: `Tenant "${input.name}" created with ${input.adminEmails.length} admin(s)`,
  };
}

async function updateTenant({ claims, data }: ActionContext) {
  requireAdmin(claims);

  const parsed = updateTenantSchema.safeParse(data);
  if (!parsed.success) throw new ApiError('invalid-argument', parsed.error.message);

  const { tenantId, geminiApiKey, ...updates } = parsed.data;
  const db = getDb();

  const tenantRef = db.collection('tenants').doc(tenantId);
  const tenantDoc = await tenantRef.get();
  if (!tenantDoc.exists) throw new ApiError('not-found', 'Tenant not found');

  if (updates.slug) {
    const currentData = tenantDoc.data();
    if (currentData?.slug !== updates.slug) {
      const existing = await db.collection('tenants').where('slug', '==', updates.slug).limit(1).get();
      if (!existing.empty) {
        throw new ApiError('already-exists', `Tenant with slug "${updates.slug}" already exists`);
      }
    }
  }

  if (geminiApiKey) {
    await createOrUpdateSecret(buildTenantGeminiSecretName(tenantId), geminiApiKey);
  }

  const firestoreUpdates: Record<string, unknown> = { ...updates, updatedAt: new Date().toISOString() };

  if (updates.artDirection) {
    const currentData = tenantDoc.data();
    firestoreUpdates.artDirection = {
      defaultBrief: '',
      quickGenBrief: '',
      shopifyGenBrief: '',
      photoshootBrief: '',
      ...currentData?.artDirection,
      ...updates.artDirection,
    };
  }

  await tenantRef.update(firestoreUpdates);
  return { success: true, tenantId };
}

async function deleteTenant({ claims, data }: ActionContext) {
  requireAdmin(claims);

  const { tenantId } = (data || {}) as { tenantId?: string };
  if (!tenantId) throw new ApiError('invalid-argument', 'tenantId is required');

  const db = getDb();
  const auth = getAuth();

  const tenantRef = db.collection('tenants').doc(tenantId);
  const tenantDoc = await tenantRef.get();
  if (!tenantDoc.exists) throw new ApiError('not-found', 'Tenant not found');

  const usersSnapshot = await db.collection(`tenants/${tenantId}/users`).get();
  for (const userDoc of usersSnapshot.docs) {
    try { await auth.setCustomUserClaims(userDoc.id, {}); } catch { /* user may be deleted */ }
    await userDoc.ref.delete();
  }

  await tenantRef.delete();
  return { success: true, tenantId };
}

async function listTenantUsers({ claims, data }: ActionContext) {
  requireAdmin(claims);

  const { tenantId } = (data || {}) as { tenantId?: string };
  if (!tenantId) throw new ApiError('invalid-argument', 'tenantId is required');

  const db = getDb();
  const snapshot = await db.collection(`tenants/${tenantId}/users`).orderBy('createdAt', 'desc').get();
  return { users: snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })) };
}

async function inviteTenantUser({ uid, claims, data }: ActionContext) {
  requireAdmin(claims);

  const { tenantId, email, role } = (data || {}) as { tenantId?: string; email?: string; role?: string };
  if (!tenantId) throw new ApiError('invalid-argument', 'tenantId is required');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError('invalid-argument', 'Valid email is required');
  }

  const userRole = role === 'tenant_user' ? 'tenant_user' : 'tenant_admin';
  const db = getDb();
  const auth = getAuth();

  const tenantDoc = await db.collection('tenants').doc(tenantId).get();
  if (!tenantDoc.exists) throw new ApiError('not-found', 'Tenant not found');

  const existingUsers = await db
    .collection(`tenants/${tenantId}/users`)
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();
  if (!existingUsers.empty) {
    throw new ApiError('already-exists', 'User is already a member of this tenant');
  }

  let userUid: string;
  try {
    const userRecord = await auth.getUserByEmail(email);
    userUid = userRecord.uid;
  } catch {
    const userRecord = await auth.createUser({ email });
    userUid = userRecord.uid;
  }

  await auth.setCustomUserClaims(userUid, { role: userRole, tenantId });
  await db.doc(`tenants/${tenantId}/users/${userUid}`).set({
    email: email.toLowerCase(),
    displayName: email.split('@')[0],
    role: userRole,
    invitedBy: uid,
    status: 'active',
    createdAt: new Date().toISOString(),
  });

  return { success: true, uid: userUid, email, role: userRole };
}

async function removeTenantUser({ claims, data }: ActionContext) {
  requireAdmin(claims);

  const { tenantId, uid: targetUid } = (data || {}) as { tenantId?: string; uid?: string };
  if (!tenantId) throw new ApiError('invalid-argument', 'tenantId is required');
  if (!targetUid) throw new ApiError('invalid-argument', 'uid is required');

  const db = getDb();
  const auth = getAuth();

  const userRef = db.doc(`tenants/${tenantId}/users/${targetUid}`);
  const userDoc = await userRef.get();
  if (!userDoc.exists) throw new ApiError('not-found', 'User not found in this tenant');

  await userRef.delete();
  try { await auth.setCustomUserClaims(targetUid, {}); } catch { /* user may be deleted */ }

  return { success: true };
}

export const POST = createRouteHandler({
  createTenant,
  updateTenant,
  deleteTenant,
  listTenantUsers,
  inviteTenantUser,
  removeTenantUser,
});
