import { shopifyConnectSchema } from '@vizo/shared';
import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAuth, requireTenantAdmin, resolveEffectiveTenantId } from '../_lib/auth';
import { ApiError } from '../_lib/errors';
import { getDb } from '../_lib/admin';
import {
  createOrUpdateSecret,
  getSecret,
  buildTenantShopifySecretName,
} from '../_lib/services/secret-manager';
import { fetchShopifyProducts, validateShopifyCredentials } from '../_lib/services/shopify-service';

const SHOPIFY_API_VERSION = '2024-01';

async function connectShopify({ claims, data }: ActionContext) {
  requireTenantAdmin(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const parsed = shopifyConnectSchema.safeParse(data);
  if (!parsed.success) throw new ApiError('invalid-argument', parsed.error.issues[0].message);

  const { storeDomain, adminApiKey } = parsed.data;

  try {
    await validateShopifyCredentials(storeDomain, adminApiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Shopify credentials';
    throw new ApiError('invalid-argument', message);
  }

  await createOrUpdateSecret(buildTenantShopifySecretName(tenantId), adminApiKey);

  const db = getDb();
  await db.doc(`tenants/${tenantId}`).update({
    'shopify.storeDomain': storeDomain,
    'shopify.connectedAt': new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { success: true, storeDomain };
}

async function syncShopifyProducts({ claims }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantDoc.exists) throw new ApiError('not-found', 'Tenant not found');

  const tenant = tenantDoc.data()!;
  const storeDomain = tenant.shopify?.storeDomain;
  if (!storeDomain) {
    throw new ApiError('failed-precondition', 'Shopify is not connected. Please connect your store first.');
  }

  const secretName = buildTenantShopifySecretName(tenantId);
  let accessToken: string;
  try {
    accessToken = await getSecret(secretName);
  } catch {
    throw new ApiError('failed-precondition', 'Shopify API key not found. Please reconnect your store.');
  }

  let shopifyProducts: Awaited<ReturnType<typeof fetchShopifyProducts>>;
  try {
    shopifyProducts = await fetchShopifyProducts(storeDomain, accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch products';
    throw new ApiError('internal', message);
  }

  const productsRef = db.collection(`tenants/${tenantId}/products`);
  const now = new Date().toISOString();

  const existingSnapshot = await productsRef.get();
  const existingByShopifyId = new Map<string, string>();
  for (const doc of existingSnapshot.docs) {
    existingByShopifyId.set(doc.data().shopifyProductId as string, doc.id);
  }

  const BATCH_LIMIT = 500;
  let batch = db.batch();
  let opCount = 0;
  const syncedShopifyIds = new Set<string>();

  for (const product of shopifyProducts) {
    syncedShopifyIds.add(product.shopifyProductId);
    const existingDocId = existingByShopifyId.get(product.shopifyProductId);
    const docRef = existingDocId ? productsRef.doc(existingDocId) : productsRef.doc();

    batch.set(docRef, { ...product, lastSyncedAt: now, ...(existingDocId ? {} : { createdAt: now }) }, { merge: true });
    opCount++;
    if (opCount >= BATCH_LIMIT) { await batch.commit(); batch = db.batch(); opCount = 0; }
  }

  for (const [shopifyId, docId] of existingByShopifyId) {
    if (!syncedShopifyIds.has(shopifyId)) {
      batch.update(productsRef.doc(docId), { status: 'archived', lastSyncedAt: now });
      opCount++;
      if (opCount >= BATCH_LIMIT) { await batch.commit(); batch = db.batch(); opCount = 0; }
    }
  }

  if (opCount > 0) await batch.commit();

  await db.doc(`tenants/${tenantId}`).update({ 'shopify.lastSyncAt': now, updatedAt: now });

  return {
    success: true,
    synced: shopifyProducts.length,
    archived: [...existingByShopifyId.keys()].filter((id) => !syncedShopifyIds.has(id)).length,
  };
}

async function disconnectShopify({ claims }: ActionContext) {
  requireTenantAdmin(claims);
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

async function listProducts({ claims }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const snapshot = await db.collection(`tenants/${tenantId}/products`).orderBy('title').get();
  return { products: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
}

async function pushImageToShopify({ uid, claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { imageId, productId } = data as { imageId: string; productId: string };
  if (!imageId || !productId) throw new ApiError('invalid-argument', 'imageId and productId are required');

  const db = getDb();
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantDoc.exists) throw new ApiError('not-found', 'Tenant not found');

  const tenant = tenantDoc.data()!;
  const storeDomain = tenant.shopify?.storeDomain;
  if (!storeDomain) throw new ApiError('failed-precondition', 'Shopify is not connected');

  let accessToken: string;
  try {
    accessToken = await getSecret(buildTenantShopifySecretName(tenantId));
  } catch {
    throw new ApiError('failed-precondition', 'Shopify credentials not configured');
  }

  // Get the image document
  const imageDoc = await db.doc(`tenants/${tenantId}/generatedImages/${imageId}`).get();
  if (!imageDoc.exists) throw new ApiError('not-found', 'Image not found');

  const imageData = imageDoc.data()!;

  // Get product to find Shopify product ID
  const productDoc = await db.doc(`tenants/${tenantId}/products/${productId}`).get();
  if (!productDoc.exists) throw new ApiError('not-found', 'Product not found');

  const productData = productDoc.data()!;
  const shopifyProductId = (productData.shopifyProductId as string).replace('gid://shopify/Product/', '');

  // Get signed URL for the image
  const { getStorage } = await import('../_lib/admin');
  const bucket = getStorage().bucket();
  const file = bucket.file(imageData.storageUrl);
  const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });

  // Upload to Shopify
  const uploadUrl = `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}/products/${shopifyProductId}/images.json`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: { src: signedUrl } }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ApiError('internal', `Shopify upload failed: ${body.slice(0, 200)}`);
  }

  const result = (await response.json()) as { image: { id: number } };

  // Update image document with Shopify reference
  await db.doc(`tenants/${tenantId}/generatedImages/${imageId}`).update({
    shopifyExportStatus: 'exported',
    shopifyImageId: String(result.image.id),
    exportedAt: new Date().toISOString(),
    exportedBy: uid,
  });

  return { success: true, shopifyImageId: String(result.image.id) };
}

async function purchaseCreditsViaShopify({ uid, claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { creditAmount } = data as { creditAmount: number };
  if (!creditAmount || creditAmount < 10 || creditAmount > 100000) {
    throw new ApiError('invalid-argument', 'Credit amount must be between 10 and 100,000');
  }

  const db = getDb();
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantDoc.exists) throw new ApiError('not-found', 'Tenant not found');

  const tenant = tenantDoc.data()!;
  const shopify = tenant.shopify;
  if (!shopify?.storeDomain) throw new ApiError('failed-precondition', 'Shopify is not connected for this tenant');

  const pricePerCredit = tenant.pricePerCredit || 0.10;
  const totalPrice = (creditAmount * pricePerCredit).toFixed(2);

  let accessToken: string;
  try {
    accessToken = await getSecret(buildTenantShopifySecretName(tenantId));
  } catch {
    throw new ApiError('failed-precondition', 'Shopify credentials not configured');
  }

  const draftOrderUrl = `https://${shopify.storeDomain}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`;
  const response = await fetch(draftOrderUrl, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draft_order: {
        line_items: [{ title: `Vizo Credits (${creditAmount} credits)`, price: totalPrice, quantity: 1, taxable: true }],
        note: `Credit purchase: ${creditAmount} credits for tenant ${tenantId}`,
        tags: `vizo-credits,tenant-${tenantId},uid-${uid},amount-${creditAmount}`,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ApiError('internal', `Failed to create Shopify order: ${body.slice(0, 200)}`);
  }

  const result = (await response.json()) as { draft_order: { id: number; invoice_url: string } };

  const now = new Date().toISOString();
  const purchaseRef = db.collection(`tenants/${tenantId}/shopifyCreditPurchases`).doc();
  await purchaseRef.set({
    shopifyDraftOrderId: String(result.draft_order.id),
    creditAmount,
    totalPrice: Number(totalPrice),
    status: 'pending',
    invoiceUrl: result.draft_order.invoice_url,
    createdAt: now,
    createdBy: uid,
    completedAt: null,
  });

  return { purchaseId: purchaseRef.id, invoiceUrl: result.draft_order.invoice_url, creditAmount, totalPrice: Number(totalPrice) };
}

async function confirmShopifyCreditPurchase({ claims, data }: ActionContext) {
  requireAuth(claims);

  const { purchaseId, tenantId: targetTenantId } = data as { purchaseId: string; tenantId: string };
  if (!purchaseId || !targetTenantId) throw new ApiError('invalid-argument', 'purchaseId and tenantId are required');

  const db = getDb();
  const purchaseDoc = await db.doc(`tenants/${targetTenantId}/shopifyCreditPurchases/${purchaseId}`).get();
  if (!purchaseDoc.exists) throw new ApiError('not-found', 'Purchase not found');

  const purchase = purchaseDoc.data()!;
  if (purchase.status === 'completed') return { success: true, message: 'Already completed' };

  const creditAmount = purchase.creditAmount;
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const tenantRef = db.doc(`tenants/${targetTenantId}`);
    const tenantSnap = await tx.get(tenantRef);
    if (!tenantSnap.exists) throw new ApiError('not-found', 'Tenant not found');

    const currentBalance = tenantSnap.data()!.creditBalance || 0;
    const newBalance = currentBalance + creditAmount;

    tx.update(tenantRef, { creditBalance: newBalance, updatedAt: now });

    const ledgerRef = db.collection(`tenants/${targetTenantId}/creditLedger`).doc();
    tx.set(ledgerRef, {
      type: 'topup_shopify',
      amount: creditAmount,
      balanceAfter: newBalance,
      description: `Shopify credit purchase: ${creditAmount} credits`,
      referenceId: purchaseId,
      createdAt: now,
      createdBy: purchase.createdBy,
    });

    tx.update(purchaseDoc.ref, { status: 'completed', completedAt: now });
  });

  return { success: true, creditAmount };
}

export const POST = createRouteHandler({
  connectShopify,
  syncShopifyProducts,
  disconnectShopify,
  listProducts,
  pushImageToShopify,
  purchaseCreditsViaShopify,
  confirmShopifyCreditPurchase,
});
