import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth, getDb } from '../services/firebase-admin';
import { DEFAULT_CREDIT_COSTS } from '@vizo/shared';

/**
 * One-time bootstrap function to create the first superadmin user.
 * Can only be called when no admins exist in the system.
 */
export const bootstrapSuperadmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const db = getDb();
  const auth = getAuth();

  // Check if any admin already exists
  const adminsSnapshot = await db.collection('admins').limit(1).get();
  if (!adminsSnapshot.empty) {
    throw new HttpsError(
      'failed-precondition',
      'Superadmin already exists. Bootstrap can only run once.',
    );
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email;
  const displayName = request.auth.token.name || email;

  if (!email) {
    throw new HttpsError('invalid-argument', 'User must have an email address');
  }

  // Set custom claims for the superadmin
  await auth.setCustomUserClaims(uid, {
    role: 'vg_admin',
  });

  // Create admin document
  await db.doc(`admins/${uid}`).set({
    email,
    displayName,
    createdAt: new Date().toISOString(),
  });

  // Initialize platform config with defaults
  await db.doc('platform/config/global/settings').set({
    creditCosts: DEFAULT_CREDIT_COSTS,
    aspectRatios: ['1:1', '4:5', '16:9'],
    zendeskUrl: '',
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  });

  // Initialize homepage config
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

  return {
    success: true,
    message: `Superadmin bootstrapped for ${email}`,
    uid,
  };
});
