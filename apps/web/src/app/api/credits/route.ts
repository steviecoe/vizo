import { z } from 'zod';
import { adminCreditTopupSchema } from '@vizo/shared';
import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAuth, requireAdmin, resolveEffectiveTenantId } from '../_lib/auth';
import { ApiError } from '../_lib/errors';
import { getDb } from '../_lib/admin';
import { reserveCredits, refundCreditsForFailure, adminTopup } from '../_lib/services/credit-service';
import { createPaymentIntent } from '../_lib/services/stripe-service';

const purchaseCreditsSchema = z.object({
  creditAmount: z.number().int().positive().min(10).max(100000),
});

async function debitCredits({ uid, claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { amount, type, description, referenceId } = data as {
    amount: number;
    type: 'debit_generation' | 'debit_photoshoot';
    description: string;
    referenceId: string;
  };

  if (!amount || amount <= 0) throw new ApiError('invalid-argument', 'Amount must be positive');

  try {
    const ledgerEntryId = await reserveCredits(tenantId, amount, type, description, referenceId, uid);
    return { success: true, ledgerEntryId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Credit debit failed';
    throw new ApiError('failed-precondition', message);
  }
}

async function refundCredits({ uid, claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const { amount, jobId } = data as { amount: number; jobId: string };
  if (!amount || amount <= 0) throw new ApiError('invalid-argument', 'Amount must be positive');
  if (!jobId) throw new ApiError('invalid-argument', 'jobId is required');

  try {
    const ledgerEntryId = await refundCreditsForFailure(tenantId, amount, jobId, uid);
    return { success: true, ledgerEntryId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Credit refund failed';
    throw new ApiError('internal', message);
  }
}

async function adminTopupCredits({ uid, claims, data }: ActionContext) {
  requireAdmin(claims);

  const parsed = adminCreditTopupSchema.safeParse(data);
  if (!parsed.success) throw new ApiError('invalid-argument', parsed.error.message);

  const { tenantId, creditAmount, description } = parsed.data;

  try {
    const ledgerEntryId = await adminTopup(tenantId, creditAmount, description, uid);
    return { success: true, ledgerEntryId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin top-up failed';
    throw new ApiError('internal', message);
  }
}

async function purchaseCredits({ uid, claims, data }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const parsed = purchaseCreditsSchema.safeParse(data);
  if (!parsed.success) throw new ApiError('invalid-argument', parsed.error.issues[0].message);

  const { creditAmount } = parsed.data;
  const db = getDb();

  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantDoc.exists) throw new ApiError('not-found', 'Tenant not found');

  const tenant = tenantDoc.data()!;
  const pricePerCredit = tenant.pricePerCredit as number;
  const amountCents = Math.round(creditAmount * pricePerCredit * 100);

  if (amountCents < 50) throw new ApiError('invalid-argument', 'Minimum payment amount is $0.50');

  const paymentRef = db.collection(`tenants/${tenantId}/stripePayments`).doc();

  const result = await createPaymentIntent(amountCents, 'usd', tenantId, uid, creditAmount);

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

async function getBillingInfo({ claims }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);
  const db = getDb();

  const [tenantDoc, paymentsSnap] = await Promise.all([
    db.doc(`tenants/${tenantId}`).get(),
    db.collection(`tenants/${tenantId}/stripePayments`).orderBy('createdAt', 'desc').limit(20).get(),
  ]);

  if (!tenantDoc.exists) throw new ApiError('not-found', 'Tenant not found');

  const tenant = tenantDoc.data()!;
  return {
    creditBalance: tenant.creditBalance,
    pricePerCredit: tenant.pricePerCredit,
    lowCreditThreshold: tenant.lowCreditThreshold,
    recentPayments: paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

export const POST = createRouteHandler({
  debitCredits,
  refundCredits,
  adminTopupCredits,
  purchaseCredits,
  getBillingInfo,
});
