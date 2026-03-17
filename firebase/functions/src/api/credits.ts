import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { requireAdmin, requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { adminCreditTopupSchema } from '@vizo/shared';
import {
  reserveCredits,
  refundCreditsForFailure,
  adminTopup,
} from '../services/credit-service';

/**
 * Debit credits before AI generation. Called by generation flows.
 */
export const debitCredits = onCall(async (request) => {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const { amount, type, description, referenceId } = request.data as {
    amount: number;
    type: 'debit_generation' | 'debit_photoshoot';
    description: string;
    referenceId: string;
  };

  if (!amount || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Amount must be positive');
  }

  try {
    const ledgerEntryId = await reserveCredits(
      tenantId,
      amount,
      type,
      description,
      referenceId,
      request.auth!.uid,
    );
    return { success: true, ledgerEntryId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Credit debit failed';
    throw new HttpsError('failed-precondition', message);
  }
});

/**
 * Refund credits after a failed AI generation (Commit-or-Refund pattern).
 */
export const refundCredits = onCall(async (request) => {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const { amount, jobId } = request.data as {
    amount: number;
    jobId: string;
  };

  if (!amount || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Amount must be positive');
  }
  if (!jobId) {
    throw new HttpsError('invalid-argument', 'jobId is required');
  }

  try {
    const ledgerEntryId = await refundCreditsForFailure(
      tenantId,
      amount,
      jobId,
      request.auth!.uid,
    );
    return { success: true, ledgerEntryId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Credit refund failed';
    throw new HttpsError('internal', message);
  }
});

/**
 * Admin manual credit top-up (e.g. for free trials).
 */
export const adminTopupCredits = onCall(async (request) => {
  requireAdmin(request);

  const parsed = adminCreditTopupSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const { tenantId, creditAmount, description } = parsed.data;

  try {
    const ledgerEntryId = await adminTopup(
      tenantId,
      creditAmount,
      description,
      request.auth!.uid,
    );
    return { success: true, ledgerEntryId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin top-up failed';
    throw new HttpsError('internal', message);
  }
});
