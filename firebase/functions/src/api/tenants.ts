import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getAuth, getDb } from '../services/firebase-admin';
import { requireAdmin } from '../middleware/auth';
import { createTenantSchema, updateTenantSchema, LOW_CREDIT_THRESHOLD_DEFAULT } from '@vizo/shared';
import { createOrUpdateSecret, buildTenantGeminiSecretName } from '../services/secret-manager';

export async function createTenantHandler(request: CallableRequest) {
  requireAdmin(request);

  const parsed = createTenantSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const input = parsed.data;
  const db = getDb();
  const auth = getAuth();
  const adminUid = request.auth!.uid;

  // Check slug uniqueness
  const existing = await db
    .collection('tenants')
    .where('slug', '==', input.slug)
    .limit(1)
    .get();
  if (!existing.empty) {
    throw new HttpsError('already-exists', `Tenant with slug "${input.slug}" already exists`);
  }

  const tenantRef = db.collection('tenants').doc();
  const tenantId = tenantRef.id;

  // Store Gemini API key in Secret Manager (not in Firestore)
  await createOrUpdateSecret(buildTenantGeminiSecretName(tenantId), input.geminiApiKey);

  // Create tenant document
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
    shopify: {
      storeDomain: null,
      connectedAt: null,
      lastSyncAt: null,
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: adminUid,
    updatedAt: new Date().toISOString(),
  });

  // Invite tenant admins
  for (const email of input.adminEmails) {
    let uid: string;
    try {
      const userRecord = await auth.getUserByEmail(email);
      uid = userRecord.uid;
    } catch {
      // User doesn't exist yet -- create a stub that activates on first login
      const userRecord = await auth.createUser({ email });
      uid = userRecord.uid;
    }

    await auth.setCustomUserClaims(uid, {
      role: 'tenant_admin',
      tenantId,
    });

    await db.doc(`tenants/${tenantId}/users/${uid}`).set({
      email,
      displayName: email.split('@')[0],
      role: 'tenant_admin',
      invitedBy: adminUid,
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

export const createTenant = onCall(createTenantHandler);

export async function updateTenantHandler(request: CallableRequest) {
  requireAdmin(request);

  const parsed = updateTenantSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const { tenantId, geminiApiKey, ...updates } = parsed.data;
  const db = getDb();

  // Verify tenant exists
  const tenantRef = db.collection('tenants').doc(tenantId);
  const tenantDoc = await tenantRef.get();
  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Tenant not found');
  }

  // Check slug uniqueness if slug is being changed
  if (updates.slug) {
    const currentData = tenantDoc.data();
    if (currentData?.slug !== updates.slug) {
      const existing = await db
        .collection('tenants')
        .where('slug', '==', updates.slug)
        .limit(1)
        .get();
      if (!existing.empty) {
        throw new HttpsError('already-exists', `Tenant with slug "${updates.slug}" already exists`);
      }
    }
  }

  // Update Gemini API key in Secret Manager if provided
  if (geminiApiKey) {
    await createOrUpdateSecret(buildTenantGeminiSecretName(tenantId), geminiApiKey);
  }

  // Build partial update — merge artDirection if provided
  const firestoreUpdates: Record<string, unknown> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

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

export const updateTenant = onCall(updateTenantHandler);

// ─── Tenant User Management ──────────────────────────────────

export async function listTenantUsersHandler(request: CallableRequest) {
  requireAdmin(request);

  const { tenantId } = (request.data || {}) as { tenantId?: string };
  if (!tenantId) {
    throw new HttpsError('invalid-argument', 'tenantId is required');
  }

  const db = getDb();
  const snapshot = await db
    .collection(`tenants/${tenantId}/users`)
    .orderBy('createdAt', 'desc')
    .get();

  const users = snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  }));

  return { users };
}

export const listTenantUsers = onCall(listTenantUsersHandler);

export async function inviteTenantUserHandler(request: CallableRequest) {
  requireAdmin(request);

  const { tenantId, email, role } = (request.data || {}) as {
    tenantId?: string;
    email?: string;
    role?: string;
  };

  if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId is required');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Valid email is required');
  }

  const userRole = role === 'tenant_user' ? 'tenant_user' : 'tenant_admin';
  const db = getDb();
  const auth = getAuth();
  const adminUid = request.auth!.uid;

  // Verify tenant exists
  const tenantDoc = await db.collection('tenants').doc(tenantId).get();
  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Tenant not found');
  }

  // Check if user is already in this tenant
  const existingUsers = await db
    .collection(`tenants/${tenantId}/users`)
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();
  if (!existingUsers.empty) {
    throw new HttpsError('already-exists', 'User is already a member of this tenant');
  }

  // Get or create Firebase Auth user
  let uid: string;
  try {
    const userRecord = await auth.getUserByEmail(email);
    uid = userRecord.uid;
  } catch {
    const userRecord = await auth.createUser({ email });
    uid = userRecord.uid;
  }

  // Set custom claims
  await auth.setCustomUserClaims(uid, {
    role: userRole,
    tenantId,
  });

  // Create user document
  await db.doc(`tenants/${tenantId}/users/${uid}`).set({
    email: email.toLowerCase(),
    displayName: email.split('@')[0],
    role: userRole,
    invitedBy: adminUid,
    status: 'active',
    createdAt: new Date().toISOString(),
  });

  return { success: true, uid, email, role: userRole };
}

export const inviteTenantUser = onCall(inviteTenantUserHandler);

export async function removeTenantUserHandler(request: CallableRequest) {
  requireAdmin(request);

  const { tenantId, uid } = (request.data || {}) as {
    tenantId?: string;
    uid?: string;
  };

  if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId is required');
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required');

  const db = getDb();
  const auth = getAuth();

  // Verify user doc exists
  const userRef = db.doc(`tenants/${tenantId}/users/${uid}`);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'User not found in this tenant');
  }

  // Remove user document
  await userRef.delete();

  // Clear custom claims (reset to no role)
  try {
    await auth.setCustomUserClaims(uid, {});
  } catch {
    // User might have been deleted from Auth already — that's fine
  }

  return { success: true };
}

export const removeTenantUser = onCall(removeTenantUserHandler);

// ─── Delete Tenant ──────────────────────────────────────────

export async function deleteTenantHandler(request: CallableRequest) {
  requireAdmin(request);

  const { tenantId } = (request.data || {}) as { tenantId?: string };
  if (!tenantId) {
    throw new HttpsError('invalid-argument', 'tenantId is required');
  }

  const db = getDb();
  const auth = getAuth();

  // Verify tenant exists
  const tenantRef = db.collection('tenants').doc(tenantId);
  const tenantDoc = await tenantRef.get();
  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Tenant not found');
  }

  // Delete all users in the tenant subcollection and clear their claims
  const usersSnapshot = await db.collection(`tenants/${tenantId}/users`).get();
  for (const userDoc of usersSnapshot.docs) {
    try {
      await auth.setCustomUserClaims(userDoc.id, {});
    } catch {
      // User might have been deleted from Auth already
    }
    await userDoc.ref.delete();
  }

  // Delete the tenant document
  await tenantRef.delete();

  return { success: true, tenantId };
}

export const deleteTenant = onCall(deleteTenantHandler);
