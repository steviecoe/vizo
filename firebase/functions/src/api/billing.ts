import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { getDb } from '../services/firebase-admin';
import {
  createPaymentIntent,
  constructWebhookEvent,
  getWebhookSecret,
  createInvoiceForPayment,
} from '../services/stripe-service';
import * as admin from 'firebase-admin';

// ─── Schemas ───────────────────────────────────────────────

const purchaseCreditsSchema = z.object({
  creditAmount: z.number().int().positive().min(10).max(100000),
});

// ─── Create Payment Intent Handler ─────────────────────────

export async function createPaymentIntentHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const uid = request.auth!.uid;

  const parsed = purchaseCreditsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const { creditAmount } = parsed.data;
  const db = getDb();

  // Load tenant to get pricePerCredit
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Tenant not found');
  }

  const tenant = tenantDoc.data()!;
  const pricePerCredit = tenant.pricePerCredit as number;
  const amountCents = Math.round(creditAmount * pricePerCredit * 100);

  if (amountCents < 50) {
    throw new HttpsError(
      'invalid-argument',
      'Minimum payment amount is $0.50',
    );
  }

  // Record pending payment in Firestore
  const paymentRef = db
    .collection(`tenants/${tenantId}/stripePayments`)
    .doc();

  const result = await createPaymentIntent(
    amountCents,
    'usd',
    tenantId,
    uid,
    creditAmount,
  );

  await paymentRef.set({
    stripePaymentIntentId: result.paymentIntentId,
    amount: amountCents,
    creditsGranted: creditAmount,
    status: 'pending',
    createdAt: new Date().toISOString(),
    createdBy: uid,
  });

  return {
    clientSecret: result.clientSecret,
    paymentIntentId: result.paymentIntentId,
    amountCents,
    creditAmount,
  };
}

// ─── Stripe Webhook Handler ────────────────────────────────

/**
 * Handles Stripe webhook events. Securely verifies the signature,
 * then processes payment_intent.succeeded to grant credits atomically.
 *
 * Flow:
 * 1. Verify webhook signature using Secret Manager secret
 * 2. Extract tenantId, uid, creditAmount from PaymentIntent metadata
 * 3. Atomically update tenant creditBalance + create ledger entry
 * 4. Update stripePayments doc status to 'succeeded'
 * 5. Create Stripe invoice for the payment
 *
 * Idempotency: checks if ledger entry already exists for this PI to
 * prevent double-crediting on webhook retries.
 */
export async function handleStripeWebhookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const signature = req.headers['stripe-signature'] as string | undefined;

  if (!signature) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event;
  try {
    const webhookSecret = await getWebhookSecret();
    event = constructWebhookEvent((req as Request & { rawBody: Buffer }).rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    res.status(400).json({ error: `Webhook verification failed: ${message}` });
    return;
  }

  // Only process payment_intent.succeeded
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as { id: string; metadata: Record<string, string>; amount: number };

    const tenantId = pi.metadata.tenantId;
    const uid = pi.metadata.uid;
    const creditAmount = parseInt(pi.metadata.creditAmount, 10);

    if (!tenantId || !uid || isNaN(creditAmount)) {
      res.status(400).json({ error: 'Missing metadata on PaymentIntent' });
      return;
    }

    const db = getDb();
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const ledgerRef = db.collection(`tenants/${tenantId}/creditLedger`).doc();

    // Idempotency check: see if we already credited for this PI
    const existingEntries = await db
      .collection(`tenants/${tenantId}/creditLedger`)
      .where('referenceId', '==', pi.id)
      .where('type', '==', 'topup_stripe')
      .limit(1)
      .get();

    if (!existingEntries.empty) {
      // Already processed — return 200 to acknowledge
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    // Atomic credit grant
    await db.runTransaction(async (tx) => {
      const tenantDoc = await tx.get(tenantRef);
      if (!tenantDoc.exists) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      const currentBalance = tenantDoc.data()!.creditBalance as number;
      const newBalance = currentBalance + creditAmount;

      tx.update(tenantRef, {
        creditBalance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(ledgerRef, {
        type: 'topup_stripe',
        amount: creditAmount,
        balanceAfter: newBalance,
        description: `Stripe payment: ${creditAmount} credits (PI: ${pi.id})`,
        referenceId: pi.id,
        createdAt: new Date().toISOString(),
        createdBy: uid,
      });
    });

    // Update payment record status
    const paymentQuery = await db
      .collection(`tenants/${tenantId}/stripePayments`)
      .where('stripePaymentIntentId', '==', pi.id)
      .limit(1)
      .get();

    if (!paymentQuery.empty) {
      await paymentQuery.docs[0].ref.update({
        status: 'succeeded',
        completedAt: new Date().toISOString(),
      });
    }

    // Create and finalize Stripe invoice for the payment
    try {
      const invoiceResult = await createInvoiceForPayment(
        tenantId,
        creditAmount,
        pi.amount,
      );
      // Store invoice reference on payment record
      if (!paymentQuery.empty) {
        await paymentQuery.docs[0].ref.update({
          stripeInvoiceId: invoiceResult.invoiceId,
          invoiceUrl: invoiceResult.invoiceUrl,
        });
      }
    } catch {
      // Invoice creation is non-critical — log but don't fail the webhook
      console.error(`Failed to create invoice for PI ${pi.id}`);
    }

    res.status(200).json({ received: true, creditsGranted: creditAmount });
    return;
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as { id: string; metadata: Record<string, string> };
    const tenantId = pi.metadata.tenantId;

    if (tenantId) {
      const db = getDb();
      const paymentQuery = await db
        .collection(`tenants/${tenantId}/stripePayments`)
        .where('stripePaymentIntentId', '==', pi.id)
        .limit(1)
        .get();

      if (!paymentQuery.empty) {
        await paymentQuery.docs[0].ref.update({
          status: 'failed',
          failedAt: new Date().toISOString(),
        });
      }
    }

    res.status(200).json({ received: true });
    return;
  }

  // Acknowledge unhandled event types
  res.status(200).json({ received: true, unhandled: event.type });
}

// ─── Get Billing Info Handler ──────────────────────────────

export async function getBillingInfoHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const db = getDb();

  const [tenantDoc, paymentsSnap] = await Promise.all([
    db.doc(`tenants/${tenantId}`).get(),
    db
      .collection(`tenants/${tenantId}/stripePayments`)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get(),
  ]);

  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Tenant not found');
  }

  const tenant = tenantDoc.data()!;

  return {
    creditBalance: tenant.creditBalance,
    pricePerCredit: tenant.pricePerCredit,
    lowCreditThreshold: tenant.lowCreditThreshold,
    recentPayments: paymentsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
  };
}

// ─── Exports ───────────────────────────────────────────────

export const handleStripeWebhook = onRequest(
  {
    timeoutSeconds: 30,
    region: 'europe-west4',
    // Raw body is needed for signature verification
    invoker: 'public',
  },
  handleStripeWebhookHandler,
);
