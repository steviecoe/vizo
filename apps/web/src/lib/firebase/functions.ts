import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getClientAuth, getClientFunctions } from './client';
import { MOCK_RESPONSES } from './mock-data';

/**
 * Waits for Firebase Auth to restore the session on page load.
 * Without this, auth.currentUser is null on first render and API calls fail.
 */
let authReady: Promise<User | null> | null = null;

function waitForAuth(): Promise<User | null> {
  if (!authReady) {
    authReady = new Promise((resolve) => {
      const auth = getClientAuth();
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }
  return authReady;
}

/**
 * Maps function names to API route paths.
 * Functions mapped to a string route → called via fetch to Next.js API route.
 * Functions not listed here → called via Firebase httpsCallable (remaining Cloud Functions).
 */
const FUNCTION_ROUTE_MAP: Record<string, string> = {
  // Art direction
  listModels: '/api/art-direction',
  createModel: '/api/art-direction',
  updateModel: '/api/art-direction',
  deleteModel: '/api/art-direction',
  listBackgrounds: '/api/art-direction',
  createBackground: '/api/art-direction',
  updateBackground: '/api/art-direction',
  deleteBackground: '/api/art-direction',
  // CMS
  createArticle: '/api/cms',
  updateArticle: '/api/cms',
  deleteArticle: '/api/cms',
  listArticlesAdmin: '/api/cms',
  listPublishedArticles: '/api/cms',
  getArticle: '/api/cms',
  // Homepage
  getHomepageConfig: '/api/homepage',
  updateHomepageConfig: '/api/homepage',
  // Images
  listImages: '/api/images',
  updateImageStatus: '/api/images',
  // Dashboard
  getTenantDashboard: '/api/dashboard',
  // Settings
  getTenantSettings: '/api/settings',
  updateTenantLanguage: '/api/settings',
  // Admin
  listTenants: '/api/admin',
  getCreditCosts: '/api/admin',
  updateCreditCosts: '/api/admin',
  getPlatformPublicConfig: '/api/admin',
  listAdmins: '/api/admin',
  addAdmin: '/api/admin',
  removeAdmin: '/api/admin',
  // Tenants
  createTenant: '/api/tenants',
  updateTenant: '/api/tenants',
  deleteTenant: '/api/tenants',
  listTenantUsers: '/api/tenants',
  inviteTenantUser: '/api/tenants',
  removeTenantUser: '/api/tenants',
  // Auth
  bootstrapSuperadmin: '/api/auth',
  impersonate: '/api/auth',
  endImpersonation: '/api/auth',
  // Credits
  debitCredits: '/api/credits',
  refundCredits: '/api/credits',
  adminTopupCredits: '/api/credits',
  purchaseCredits: '/api/credits',
  getBillingInfo: '/api/credits',
  // Shopify
  connectShopify: '/api/shopify',
  syncShopifyProducts: '/api/shopify',
  disconnectShopify: '/api/shopify',
  pushImageToShopify: '/api/shopify',
  listProducts: '/api/shopify',
  purchaseCreditsViaShopify: '/api/shopify',
  confirmShopifyCreditPurchase: '/api/shopify',
  // Reporting
  getReportingData: '/api/reporting',
  // Photoshoots
  listPhotoshoots: '/api/photoshoots',
};

export async function callFunction<TResult = unknown>(
  name: string,
  _data?: unknown,
): Promise<TResult> {
  await new Promise((r) => setTimeout(r, 300)); // simulate network
  if (name in MOCK_RESPONSES) return MOCK_RESPONSES[name] as TResult;
  return {} as TResult;
}
