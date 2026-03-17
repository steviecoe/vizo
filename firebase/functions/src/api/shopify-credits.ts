import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../services/firebase-admin';
import { requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { getSecret, buildTenantShopifySecretName } from '../services/secret-manager';

// ─── Types ─────────────────────────────────────────────────

interface ShopifyDraftOrderResponse {
  draft_order: {
    id: number;
    invoice_url: string;
    status: string;
  };
}

// ─── Constants ─────────────────────────────────────────────

const SHOPIFY_API_VERSION = '2024-01';

// ─── Create Shopify Credit Purchase ────────────────────────

/**
 * Creates a Shopify draft order for credit purchase.
 * The tenant completes payment through Shopify's checkout.
 * A webhook (to be configured separately) will confirm and credit the account.
 *
 * This is basic infrastructure — full Shopify integration details TBD per SOW.
 */
export async function purchaseCreditsViaShopifyHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const uid = request.auth!.uid;

  const { creditAmount } = request.data as { creditAmount: number };

  if (!creditAmount || creditAmount < 10 || creditAmount > 100000) {
    throw new HttpsError('invalid-argument', 'Credit amount must be between 10 and 100,000');
  }

  const db = getDb();

  // 1. Load tenant config to get Shopify connection and price per credit
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Tenant not found');
  }

  const tenant = tenantDoc.data()!;
  const shopify = tenant.shopify;

  if (!shopify?.storeDomain) {
    throw new HttpsError('failed-precondition', 'Shopify is not connected for this tenant');
  }

  const pricePerCredit = tenant.pricePerCredit || 0.10;
  const totalPrice = (creditAmount * pricePerCredit).toFixed(2);

  // 2. Get Shopify access token
  let accessToken: string;
  try {
    accessToken = await getSecret(buildTenantShopifySecretName(tenantId));
  } catch {
    throw new HttpsError('failed-precondition', 'Shopify credentials not configured');
  }

  // 3. Create a draft order in Shopify
  const draftOrderUrl = `https://${shopify.storeDomain}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`;

  const draftOrderPayload = {
    draft_order: {
      line_items: [
        {
          title: `Vizo Credits (${creditAmount} credits)`,
          price: totalPrice,
          quantity: 1,
          taxable: true,
        },
      ],
      note: `Credit purchase: ${creditAmount} credits for tenant ${tenantId}`,
      tags: `vizo-credits,tenant-${tenantId},uid-${uid},amount-${creditAmount}`,
    },
  };

  const response = await fetch(draftOrderUrl, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(draftOrderPayload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new HttpsError(
      'internal',
      `Failed to create Shopify order: ${body.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as ShopifyDraftOrderResponse;

  // 4. Record pending purchase in Firestore
  const now = new Date().toISOString();
  const purchaseRef = db.collection(`tenants/${tenantId}/shopifyCreditPurchases`).doc();
  await purchaseRef.set({
    shopifyDraftOrderId: String(data.draft_order.id),
    creditAmount,
    totalPrice: Number(totalPrice),
    status: 'pending',
    invoiceUrl: data.draft_order.invoice_url,
    createdAt: now,
    createdBy: uid,
    completedAt: null,
  });

  return {
    purchaseId: purchaseRef.id,
    invoiceUrl: data.draft_order.invoice_url,
    creditAmount,
    totalPrice: Number(totalPrice),
  };
}

export const purchaseCreditsViaShopify = onCall(purchaseCreditsViaShopifyHandler);

// ─── Confirm Shopify Credit Purchase (webhook callback) ────

/**
 * Called when a Shopify order is paid (via webhook or manual trigger).
 * Credits the tenant's account with the purchased credits.
 *
 * In production, this would be triggered by a Shopify webhook.
 * For now, it can also be called manually by an admin.
 */
export async function confirmShopifyCreditPurchaseHandler(request: CallableRequest) {
  requireAuth(request);

  const { purchaseId, tenantId: targetTenantId } = request.data as {
    purchaseId: string;
    tenantId: string;
  };

  if (!purchaseId || !targetTenantId) {
    throw new HttpsError('invalid-argument', 'purchaseId and tenantId are required');
  }

  const db = getDb();
  const purchaseDoc = await db.doc(`tenants/${targetTenantId}/shopifyCreditPurchases/${purchaseId}`).get();

  if (!purchaseDoc.exists) {
    throw new HttpsError('not-found', 'Purchase not found');
  }

  const purchase = purchaseDoc.data()!;
  if (purchase.status === 'completed') {
    return { success: true, message: 'Already completed' };
  }

  const creditAmount = purchase.creditAmount;
  const now = new Date().toISOString();

  // Credit the tenant's account
  await db.runTransaction(async (tx) => {
    const tenantRef = db.doc(`tenants/${targetTenantId}`);
    const tenantSnap = await tx.get(tenantRef);

    if (!tenantSnap.exists) {
      throw new HttpsError('not-found', 'Tenant not found');
    }

    const currentBalance = tenantSnap.data()!.creditBalance || 0;
    const newBalance = currentBalance + creditAmount;

    tx.update(tenantRef, { creditBalance: newBalance, updatedAt: now });

    // Create ledger entry
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

    // Mark purchase as completed
    tx.update(purchaseDoc.ref, { status: 'completed', completedAt: now });
  });

  return { success: true, creditAmount };
}

export const confirmShopifyCreditPurchase = onCall(confirmShopifyCreditPurchaseHandler);
