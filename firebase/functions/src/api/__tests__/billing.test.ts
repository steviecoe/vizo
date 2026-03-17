import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
  getStorage: vi.fn(),
}));

vi.mock('../../services/stripe-service', () => ({
  createPaymentIntent: vi.fn(),
  constructWebhookEvent: vi.fn(),
  getWebhookSecret: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
  default: { initializeApp: vi.fn() },
  firestore: { FieldValue: { serverTimestamp: vi.fn().mockReturnValue('SERVER_TS') } },
}));

import {
  createPaymentIntentHandler,
  handleStripeWebhookHandler,
  getBillingInfoHandler,
} from '../billing';
import { getDb } from '../../services/firebase-admin';
import {
  createPaymentIntent,
  constructWebhookEvent,
  getWebhookSecret,
} from '../../services/stripe-service';
import { makeTenantAdminClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;
const mockCreatePI = createPaymentIntent as ReturnType<typeof vi.fn>;
const mockConstructEvent = constructWebhookEvent as ReturnType<typeof vi.fn>;
const mockGetWebhookSecret = getWebhookSecret as ReturnType<typeof vi.fn>;

function makeRequest(data: Record<string, unknown> = {}): CallableRequest {
  return {
    data,
    auth: { uid: 'user-uid-1', token: makeTenantAdminClaims() },
    rawRequest: {},
  } as unknown as CallableRequest;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

// ─── createPaymentIntentHandler ────────────────────────────

describe('createPaymentIntentHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid credit amount', async () => {
    await expect(
      createPaymentIntentHandler(makeRequest({ creditAmount: 5 })),
    ).rejects.toThrow();
  });

  it('rejects amount below $0.50 minimum', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ pricePerCredit: 0.001 }),
        }),
      }),
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          set: vi.fn().mockResolvedValue(undefined),
          id: 'payment-1',
        }),
      }),
    });

    await expect(
      createPaymentIntentHandler(makeRequest({ creditAmount: 10 })),
    ).rejects.toThrow('Minimum payment');
  });

  it('creates payment intent and records pending payment', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ pricePerCredit: 0.5 }),
        }),
      }),
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          set: mockSet,
          id: 'payment-1',
        }),
      }),
    });

    mockCreatePI.mockResolvedValue({
      clientSecret: 'pi_secret_123',
      paymentIntentId: 'pi_123',
    });

    const result = await createPaymentIntentHandler(makeRequest({ creditAmount: 100 }));

    expect(result.clientSecret).toBe('pi_secret_123');
    expect(result.paymentIntentId).toBe('pi_123');
    expect(result.amountCents).toBe(5000); // 100 * $0.50 * 100
    expect(result.creditAmount).toBe(100);

    expect(mockCreatePI).toHaveBeenCalledWith(
      5000,
      'usd',
      'tenant-1',
      'user-uid-1',
      100,
    );

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        stripePaymentIntentId: 'pi_123',
        status: 'pending',
        creditsGranted: 100,
      }),
    );
  });
});

// ─── handleStripeWebhookHandler ────────────────────────────

describe('handleStripeWebhookHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects missing stripe-signature', async () => {
    const req = { headers: {} } as unknown as Parameters<typeof handleStripeWebhookHandler>[0];
    const res = makeRes();

    await handleStripeWebhookHandler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Missing stripe-signature header' }),
    );
  });

  it('rejects invalid signature', async () => {
    const req = {
      headers: { 'stripe-signature': 'bad_sig' },
      rawBody: Buffer.from('{}'),
    } as unknown as Parameters<typeof handleStripeWebhookHandler>[0];
    const res = makeRes();

    mockGetWebhookSecret.mockResolvedValue('whsec_test');
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    await handleStripeWebhookHandler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Invalid signature') }),
    );
  });

  it('grants credits atomically on payment_intent.succeeded', async () => {
    const req = {
      headers: { 'stripe-signature': 'valid_sig' },
      rawBody: Buffer.from('{}'),
    } as unknown as Parameters<typeof handleStripeWebhookHandler>[0];
    const res = makeRes();

    mockGetWebhookSecret.mockResolvedValue('whsec_test');
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          metadata: { tenantId: 'tenant-1', uid: 'user-uid-1', creditAmount: '100' },
          amount: 5000,
        },
      },
    });

    const mockTx = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ creditBalance: 500 }),
      }),
      update: vi.fn(),
      set: vi.fn(),
    };

    const mockUpdate = vi.fn().mockResolvedValue(undefined);

    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ creditBalance: 500 }) }),
      }),
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({ id: 'ledger-new' }),
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ empty: true }),
            }),
          }),
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ ref: { update: mockUpdate } }],
            }),
          }),
        }),
      }),
      runTransaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => {
        await fn(mockTx);
      }),
    });

    await handleStripeWebhookHandler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, creditsGranted: 100 }),
    );

    // Verify transaction updated balance: 500 + 100 = 600
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ creditBalance: 600 }),
    );

    // Verify ledger entry was created
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'topup_stripe',
        amount: 100,
        balanceAfter: 600,
        referenceId: 'pi_123',
      }),
    );
  });

  it('handles duplicate webhook (idempotency)', async () => {
    const req = {
      headers: { 'stripe-signature': 'valid_sig' },
      rawBody: Buffer.from('{}'),
    } as unknown as Parameters<typeof handleStripeWebhookHandler>[0];
    const res = makeRes();

    mockGetWebhookSecret.mockResolvedValue('whsec_test');
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          metadata: { tenantId: 'tenant-1', uid: 'user-uid-1', creditAmount: '100' },
        },
      },
    });

    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({}),
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({ id: 'ledger-new' }),
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ empty: false }), // Already exists!
            }),
          }),
        }),
      }),
    });

    await handleStripeWebhookHandler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, duplicate: true }),
    );
  });

  it('handles payment_intent.payment_failed', async () => {
    const req = {
      headers: { 'stripe-signature': 'valid_sig' },
      rawBody: Buffer.from('{}'),
    } as unknown as Parameters<typeof handleStripeWebhookHandler>[0];
    const res = makeRes();

    mockGetWebhookSecret.mockResolvedValue('whsec_test');
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_456',
          metadata: { tenantId: 'tenant-1' },
        },
      },
    });

    const mockPaymentUpdate = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ ref: { update: mockPaymentUpdate } }],
            }),
          }),
        }),
      }),
    });

    await handleStripeWebhookHandler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPaymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('acknowledges unhandled event types', async () => {
    const req = {
      headers: { 'stripe-signature': 'valid_sig' },
      rawBody: Buffer.from('{}'),
    } as unknown as Parameters<typeof handleStripeWebhookHandler>[0];
    const res = makeRes();

    mockGetWebhookSecret.mockResolvedValue('whsec_test');
    mockConstructEvent.mockReturnValue({
      type: 'charge.refunded',
      data: { object: {} },
    });

    await handleStripeWebhookHandler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, unhandled: 'charge.refunded' }),
    );
  });
});

// ─── getBillingInfoHandler ─────────────────────────────────

describe('getBillingInfoHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns billing info with recent payments', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            creditBalance: 1000,
            pricePerCredit: 0.5,
            lowCreditThreshold: 50,
          }),
        }),
      }),
      collection: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: [
                {
                  id: 'pay-1',
                  data: () => ({
                    creditsGranted: 200,
                    amount: 10000,
                    status: 'succeeded',
                    createdAt: '2025-01-20T00:00:00Z',
                  }),
                },
              ],
            }),
          }),
        }),
      }),
    });

    const result = await getBillingInfoHandler(makeRequest());

    expect(result.creditBalance).toBe(1000);
    expect(result.pricePerCredit).toBe(0.5);
    expect(result.lowCreditThreshold).toBe(50);
    expect(result.recentPayments).toHaveLength(1);
    expect(result.recentPayments[0].id).toBe('pay-1');
  });
});
