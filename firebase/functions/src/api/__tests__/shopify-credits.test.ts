import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../services/secret-manager', () => ({
  getSecret: vi.fn(),
  buildTenantShopifySecretName: vi.fn((id: string) => `tenant-${id}-shopify-api-key`),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  purchaseCreditsViaShopifyHandler,
  confirmShopifyCreditPurchaseHandler,
} from '../shopify-credits';
import { getDb } from '../../services/firebase-admin';
import { getSecret } from '../../services/secret-manager';
import { makeTenantUserClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;
const mockGetSecret = getSecret as ReturnType<typeof vi.fn>;

function makeRequest(data: Record<string, unknown> = {}): CallableRequest {
  return {
    data,
    auth: { uid: 'user-uid-1', token: makeTenantUserClaims() },
    rawRequest: {},
  } as unknown as CallableRequest;
}

// ─── purchaseCreditsViaShopifyHandler ─────────────────────

describe('purchaseCreditsViaShopifyHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('creates draft order for credit purchase', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            shopify: {
              storeDomain: 'fashion-brand.myshopify.com',
              connectedAt: '2025-01-15T00:00:00Z',
            },
            pricePerCredit: 0.5,
          }),
        }),
      }),
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          id: 'purchase-1',
          set: mockSet,
        }),
      }),
    });

    mockGetSecret.mockResolvedValue('shpat_test_token_123');

    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        draft_order: {
          id: 99001,
          invoice_url: 'https://fashion-brand.myshopify.com/invoice/99001',
          status: 'open',
        },
      }),
    });

    const result = await purchaseCreditsViaShopifyHandler(
      makeRequest({ creditAmount: 100 }),
    );

    expect(result.purchaseId).toBe('purchase-1');
    expect(result.invoiceUrl).toBe('https://fashion-brand.myshopify.com/invoice/99001');
    expect(result.creditAmount).toBe(100);
    expect(result.totalPrice).toBe(50); // 100 * 0.5

    // Verify fetch was called with Shopify API
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('fashion-brand.myshopify.com'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Shopify-Access-Token': 'shpat_test_token_123',
        }),
      }),
    );

    // Verify pending purchase recorded
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        shopifyDraftOrderId: '99001',
        creditAmount: 100,
        status: 'pending',
      }),
    );
  });

  it('rejects when Shopify is not connected', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            shopify: { storeDomain: null },
            pricePerCredit: 0.5,
          }),
        }),
      }),
    });

    await expect(
      purchaseCreditsViaShopifyHandler(makeRequest({ creditAmount: 100 })),
    ).rejects.toThrow('Shopify is not connected');
  });

  it('rejects invalid credit amount', async () => {
    await expect(
      purchaseCreditsViaShopifyHandler(makeRequest({ creditAmount: 5 })),
    ).rejects.toThrow('Credit amount must be between 10 and 100,000');
  });

  it('rejects zero credit amount', async () => {
    await expect(
      purchaseCreditsViaShopifyHandler(makeRequest({ creditAmount: 0 })),
    ).rejects.toThrow('Credit amount must be between 10 and 100,000');
  });

  it('throws when Shopify API fails', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            shopify: { storeDomain: 'shop.myshopify.com' },
            pricePerCredit: 0.1,
          }),
        }),
      }),
    });

    mockGetSecret.mockResolvedValue('shpat_test');

    mockFetch.mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    });

    await expect(
      purchaseCreditsViaShopifyHandler(makeRequest({ creditAmount: 100 })),
    ).rejects.toThrow('Failed to create Shopify order');
  });
});

// ─── confirmShopifyCreditPurchaseHandler ──────────────────

describe('confirmShopifyCreditPurchaseHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('credits tenant account on confirmation', async () => {
    const mockTx = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ creditBalance: 500 }),
      }),
      update: vi.fn(),
      set: vi.fn(),
    };

    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          ref: { update: vi.fn() },
          data: () => ({
            creditAmount: 200,
            status: 'pending',
            createdBy: 'user-uid-1',
          }),
        }),
      }),
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({ id: 'ledger-new' }),
      }),
      runTransaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => {
        await fn(mockTx);
      }),
    });

    const result = await confirmShopifyCreditPurchaseHandler(
      makeRequest({ purchaseId: 'purchase-1', tenantId: 'tenant-1' }),
    );

    expect(result.success).toBe(true);
    expect(result.creditAmount).toBe(200);

    // Verify balance updated: 500 + 200 = 700
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ creditBalance: 700 }),
    );

    // Verify ledger entry
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'topup_shopify',
        amount: 200,
        balanceAfter: 700,
      }),
    );
  });

  it('returns success if already completed (idempotent)', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            creditAmount: 200,
            status: 'completed',
          }),
        }),
      }),
    });

    const result = await confirmShopifyCreditPurchaseHandler(
      makeRequest({ purchaseId: 'purchase-1', tenantId: 'tenant-1' }),
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Already completed');
  });

  it('rejects missing parameters', async () => {
    await expect(
      confirmShopifyCreditPurchaseHandler(makeRequest({})),
    ).rejects.toThrow('purchaseId and tenantId are required');
  });
});
