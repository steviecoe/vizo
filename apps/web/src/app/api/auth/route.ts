import { DEFAULT_CREDIT_COSTS } from '@vizo/shared';
import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAdmin } from '../_lib/auth';
import { ApiError } from '../_lib/errors';
import { getDb, getAuth } from '../_lib/admin';

async function bootstrapSuperadmin({ uid, claims }: ActionContext) {
  // Special case: only requires authentication, not admin role (first-time setup)
  const db = getDb();
  const auth = getAuth();

  const adminsSnapshot = await db.collection('admins').limit(1).get();
  if (!adminsSnapshot.empty) {
    throw new ApiError('failed-precondition', 'Superadmin already exists. Bootstrap can only run once.');
  }

  // email and name come from the decoded ID token, not CustomClaims
  const decodedToken = claims as unknown as Record<string, unknown>;
  const email = decodedToken.email as string | undefined;
  const displayName = (decodedToken.name as string | undefined) || email;

  if (!email) {
    throw new ApiError('invalid-argument', 'User must have an email address');
  }

  await auth.setCustomUserClaims(uid, { role: 'vg_admin' });

  await db.doc(`admins/${uid}`).set({
    email,
    displayName,
    createdAt: new Date().toISOString(),
  });

  await db.doc('platform/config/global/settings').set({
    creditCosts: DEFAULT_CREDIT_COSTS,
    aspectRatios: ['1:1', '4:5', '16:9'],
    zendeskUrl: '',
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  });

  await db.doc('platform/config/homepage/content').set({
    hero: {
      imageUrl: '',
      title: 'Welcome to Vizo Image Gen',
      subtitle: 'AI-powered fashion photography',
      ctaText: 'Get Started',
      ctaLink: '/login',
    },
    whatsNew: [],
    trending: [],
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  });

  return { success: true, message: `Superadmin bootstrapped for ${email}`, uid };
}

async function impersonate({ uid, claims, data }: ActionContext) {
  requireAdmin(claims);

  const { targetTenantId } = data as { targetTenantId: string };
  if (!targetTenantId) throw new ApiError('invalid-argument', 'targetTenantId is required');

  const db = getDb();
  const auth = getAuth();

  const tenantDoc = await db.doc(`tenants/${targetTenantId}`).get();
  if (!tenantDoc.exists) throw new ApiError('not-found', `Tenant ${targetTenantId} not found`);

  const tenantData = tenantDoc.data()!;
  const email = ((claims as unknown as Record<string, unknown>).email as string) || '';

  const customToken = await auth.createCustomToken(uid, {
    role: 'vg_admin',
    impersonating: true,
    impersonatedTenantId: targetTenantId,
    originalUid: uid,
  });

  await db.collection('auditLog').add({
    action: 'impersonation_start',
    adminUid: uid,
    adminEmail: email,
    targetTenantId,
    targetTenantName: tenantData.name,
    timestamp: new Date().toISOString(),
  });

  return { customToken, tenantName: tenantData.name, tenantId: targetTenantId };
}

async function endImpersonation({ uid, claims }: ActionContext) {
  const isImpersonating = claims.impersonating === true;
  if (!isImpersonating) {
    throw new ApiError('failed-precondition', 'Not currently impersonating');
  }

  const db = getDb();
  const auth = getAuth();
  const email = ((claims as unknown as Record<string, unknown>).email as string) || '';
  const targetTenantId = claims.impersonatedTenantId as string;

  const customToken = await auth.createCustomToken(uid, { role: 'vg_admin' });

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

export const POST = createRouteHandler({ bootstrapSuperadmin, impersonate, endImpersonation });
