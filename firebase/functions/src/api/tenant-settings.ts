import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../services/firebase-admin';
import { requireAuth, requireTenantAdmin, resolveEffectiveTenantId } from '../middleware/auth';

// ─── Get Tenant Settings (language, etc.) ──────────────────

export async function getTenantSettingsHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const doc = await db.doc(`tenants/${tenantId}`).get();

  if (!doc.exists) {
    throw new HttpsError('not-found', 'Tenant not found');
  }

  const data = doc.data()!;
  return {
    language: data.language || { defaultLocale: 'en', autoDetect: true },
  };
}

export const getTenantSettings = onCall(getTenantSettingsHandler);

// ─── Update Tenant Language Settings ───────────────────────

export async function updateTenantLanguageHandler(request: CallableRequest) {
  const claims = requireTenantAdmin(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const { defaultLocale, autoDetect } = request.data as {
    defaultLocale?: string;
    autoDetect?: boolean;
  };

  const supportedLocales = ['en', 'pl', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ja', 'ko', 'zh'];

  if (defaultLocale && !supportedLocales.includes(defaultLocale)) {
    throw new HttpsError('invalid-argument', 'Unsupported locale');
  }

  const db = getDb();
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();

  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Tenant not found');
  }

  const currentLanguage = tenantDoc.data()!.language || { defaultLocale: 'en', autoDetect: true };

  const updatedLanguage = {
    defaultLocale: defaultLocale || currentLanguage.defaultLocale,
    autoDetect: autoDetect !== undefined ? autoDetect : currentLanguage.autoDetect,
  };

  await db.doc(`tenants/${tenantId}`).update({
    language: updatedLanguage,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, language: updatedLanguage };
}

export const updateTenantLanguage = onCall(updateTenantLanguageHandler);
