import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { shopifyConnectSchema } from '@vizo/shared';
import { requireAuth, requireTenantAdmin, resolveEffectiveTenantId } from '../middleware/auth';
import { getDb } from '../services/firebase-admin';
import {
  createOrUpdateSecret,
  getSecret,
  buildTenantShopifySecretName,
} from '../services/secret-manager';
import {
  fetchShopifyProducts,
  validateShopifyCredentials,
} from '../services/shopify-service';

// ─── Connect Shopify ──────────────────────────────────────

export async function connectShopifyHandler(request: CallableRequest) {
  const claims = requireTenantAdmin(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const parsed = shopifyConnectSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const { storeDomain, adminApiKey } = parsed.data;

  // Validate credentials against Shopify before storing
  try {
    await validateShopifyCredentials(storeDomain, adminApiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Shopify credentials';
    throw new HttpsError('invalid-argument', message);
  }

  // Store API key in Secret Manager (never in Firestore)
  const secretName = buildTenantShopifySecretName(tenantId);
  await createOrUpdateSecret(secretName, adminApiKey);

  // Update tenant shopify config in Firestore (no key stored here)
  const db = getDb();
  await db.doc(`tenants/${tenantId}`).update({
    'shopify.storeDomain': storeDomain,
    'shopify.connectedAt': new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { success: true, storeDomain };
}

export const connectShopify = onCall(connectShopifyHandler);

// ─── Sync Shopify Products ────────────────────────────────

export async function syncShopifyProductsHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  // 1. Load tenant to get storeDomain
  const db = getDb();
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Tenant not found');
  }

  const tenant = tenantDoc.data()!;
  const storeDomain = tenant.shopify?.storeDomain;
  if (!storeDomain) {
    throw new HttpsError(
      'failed-precondition',
      'Shopify is not connected. Please connect your store first.',
    );
  }

  // 2. Retrieve API key from Secret Manager
  const secretName = buildTenantShopifySecretName(tenantId);
  let accessToken: string;
  try {
    accessToken = await getSecret(secretName);
  } catch {
    throw new HttpsError(
      'failed-precondition',
      'Shopify API key not found. Please reconnect your store.',
    );
  }

  // 3. Fetch products from Shopify
  let shopifyProducts: Awaited<ReturnType<typeof fetchShopifyProducts>>;
  try {
    shopifyProducts = await fetchShopifyProducts(storeDomain, accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch products';
    throw new HttpsError('internal', message);
  }

  // 4. Upsert into Firestore using batched writes
  const productsRef = db.collection(`tenants/${tenantId}/products`);
  const now = new Date().toISOString();

  // Index existing products by shopifyProductId for delta sync
  const existingSnapshot = await productsRef.get();
  const existingByShopifyId = new Map<string, string>();
  for (const doc of existingSnapshot.docs) {
    const data = doc.data();
    existingByShopifyId.set(data.shopifyProductId as string, doc.id);
  }

  // Firestore batches are limited to 500 operations
  const BATCH_LIMIT = 500;
  let batch = db.batch();
  let opCount = 0;

  const syncedShopifyIds = new Set<string>();

  for (const product of shopifyProducts) {
    syncedShopifyIds.add(product.shopifyProductId);

    const existingDocId = existingByShopifyId.get(product.shopifyProductId);
    const docRef = existingDocId
      ? productsRef.doc(existingDocId)
      : productsRef.doc();

    const data = {
      ...product,
      lastSyncedAt: now,
      ...(existingDocId ? {} : { createdAt: now }),
    };

    batch.set(docRef, data, { merge: true });
    opCount++;

    if (opCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  // Mark products no longer in Shopify as archived
  for (const [shopifyId, docId] of existingByShopifyId) {
    if (!syncedShopifyIds.has(shopifyId)) {
      batch.update(productsRef.doc(docId), {
        status: 'archived',
        lastSyncedAt: now,
      });
      opCount++;

      if (opCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }
  }

  // Commit remaining operations
  if (opCount > 0) {
    await batch.commit();
  }

  // 5. Update tenant lastSyncAt
  await db.doc(`tenants/${tenantId}`).update({
    'shopify.lastSyncAt': now,
    updatedAt: now,
  });

  return {
    success: true,
    synced: shopifyProducts.length,
    archived: [...existingByShopifyId.keys()].filter(
      (id) => !syncedShopifyIds.has(id),
    ).length,
  };
}

export const syncShopifyProducts = onCall(
  { timeoutSeconds: 120 },
  syncShopifyProductsHandler,
);

// ─── Disconnect Shopify ───────────────────────────────────

export async function disconnectShopifyHandler(request: CallableRequest) {
  const claims = requireTenantAdmin(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  await db.doc(`tenants/${tenantId}`).update({
    'shopify.storeDomain': null,
    'shopify.connectedAt': null,
    'shopify.lastSyncAt': null,
    updatedAt: new Date().toISOString(),
  });

  return { success: true };
}

export const disconnectShopify = onCall(disconnectShopifyHandler);

// ─── List Products ────────────────────────────────────────

export async function listProductsHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const snapshot = await db
    .collection(`tenants/${tenantId}/products`)
    .orderBy('title')
    .get();

  const products = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return { products };
}

export const listProducts = onCall(listProductsHandler);
