import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAuth, requireTenantAdmin, resolveEffectiveTenantId } from '../_lib/auth';
import { ApiError } from '../_lib/errors';
import { getDb } from '../_lib/admin';

async function getTenantSettings({ claims }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const doc = await db.doc(`tenants/${tenantId}`).get();
  if (!doc.exists) throw new ApiError('not-found', 'Tenant not found');

  const data = doc.data()!;
  return { language: data.language || { defaultLocale: 'en', autoDetect: true } };
}

async function updateTenantLanguage({ claims, data }: ActionContext) {
  requireTenantAdmin(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { defaultLocale, autoDetect } = (data || {}) as {
    defaultLocale?: string;
    autoDetect?: boolean;
  };

  const supportedLocales = ['en', 'pl', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ja', 'ko', 'zh'];
  if (defaultLocale && !supportedLocales.includes(defaultLocale)) {
    throw new ApiError('invalid-argument', 'Unsupported locale');
  }

  const db = getDb();
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantDoc.exists) throw new ApiError('not-found', 'Tenant not found');

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

export const POST = createRouteHandler({ getTenantSettings, updateTenantLanguage });
