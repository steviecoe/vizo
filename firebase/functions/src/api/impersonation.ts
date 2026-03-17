import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getAuth, getDb } from '../services/firebase-admin';
import { requireAdmin } from '../middleware/auth';

/**
 * Generates a custom token for admin impersonation of a tenant.
 * Only VG admins can call this. Logs an audit trail entry.
 */
export async function impersonateHandler(request: CallableRequest) {
  requireAdmin(request);
  const { targetTenantId } = request.data as { targetTenantId: string };

  if (!targetTenantId) {
    throw new HttpsError('invalid-argument', 'targetTenantId is required');
  }

  const db = getDb();
  const auth = getAuth();

  // Verify tenant exists
  const tenantDoc = await db.doc(`tenants/${targetTenantId}`).get();
  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', `Tenant ${targetTenantId} not found`);
  }

  const tenantData = tenantDoc.data()!;
  const uid = request.auth!.uid;
  const email = request.auth!.token.email || '';

  // Mint a custom token with impersonation claims
  const customToken = await auth.createCustomToken(uid, {
    role: 'vg_admin',
    impersonating: true,
    impersonatedTenantId: targetTenantId,
    originalUid: uid,
  });

  // Log audit trail
  await db.collection('auditLog').add({
    action: 'impersonation_start',
    adminUid: uid,
    adminEmail: email,
    targetTenantId,
    targetTenantName: tenantData.name,
    timestamp: new Date().toISOString(),
  });

  return {
    customToken,
    tenantName: tenantData.name,
    tenantId: targetTenantId,
  };
}

export const impersonate = onCall(impersonateHandler);

/**
 * Ends impersonation by minting a clean admin token.
 */
export async function endImpersonationHandler(request: CallableRequest) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const token = request.auth.token;
  const isImpersonating = token.impersonating === true;

  if (!isImpersonating) {
    throw new HttpsError('failed-precondition', 'Not currently impersonating');
  }

  const db = getDb();
  const auth = getAuth();
  const uid = request.auth.uid;
  const email = request.auth.token.email || '';
  const targetTenantId = token.impersonatedTenantId as string;

  // Mint a clean admin token (no impersonation claims)
  const customToken = await auth.createCustomToken(uid, {
    role: 'vg_admin',
  });

  // Log audit trail
  await db.collection('auditLog').add({
    action: 'impersonation_end',
    adminUid: uid,
    adminEmail: email,
    targetTenantId,
    targetTenantName: '',
    timestamp: new Date().toISOString(),
  });

  return { customToken };
}

export const endImpersonation = onCall(endImpersonationHandler);
