import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
  getAuth: vi.fn(),
}));

vi.mock('../../services/secret-manager', () => ({
  createOrUpdateSecret: vi.fn(),
  getSecret: vi.fn(),
  buildTenantShopifySecretName: vi.fn((id: string) => `tenant-${id}-shopify-api-key`),
}));

vi.mock('../../services/shopify-service', () => ({
  fetchShopifyProducts: vi.fn(),
  validateShopifyCredentials: vi.fn(),
}));

import {
  connectShopifyHandler,
  syncShopifyProductsHandler,
  disconnectShopifyHandler,
  listProductsHandler,
} from '../shopify';
import { getDb } from '../../services/firebase-admin';
import { createOrUpdateSecret, getSecret } from '../../services/secret-manager';
import {
  fetchShopifyProducts,
  validateShopifyCredentials,
} from '../../services/shopify-service';
import { makeTenantAdminClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;
const mockCreateOrUpdateSecret = createOrUpdateSecret as ReturnType<typeof vi.fn>;
const mockGetSecret = getSecret as ReturnType<typeof vi.fn>;
const mockFetchProducts = fetchShopifyProducts as ReturnType<typeof vi.fn>;
const mockValidate = validateShopifyCredentials as ReturnType<typeof vi.fn>;

function makeRequest(
  data: Record<string, unknown> = {},
  token?: Record<string, unknown>,
): CallableRequest {
  return {
    data,
    auth: {
      uid: 'user-uid-1',
      token: token ?? makeTenantAdminClaims(),
    },
    rawRequest: {},
  } as unknown as CallableRequest;
}

// ─── connectShopifyHandler ────────────────────────────────

describe('connectShopifyHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates credentials, stores key in Secret Manager, and updates tenant', async () => {
    mockValidate.mockResolvedValue({ shopName: 'My Store' });
    mockCreateOrUpdateSecret.mockResolvedValue(undefined);

    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({ update: mockUpdate }),
    });

    const result = await connectShopifyHandler(
      makeRequest({
        storeDomain: 'my-store.myshopify.com',
        adminApiKey: 'shpat_test123',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.storeDomain).toBe('my-store.myshopify.com');

    // Secret Manager called with tenant-specific name
    expect(mockCreateOrUpdateSecret).toHaveBeenCalledWith(
      'tenant-tenant-1-shopify-api-key',
      'shpat_test123',
    );

    // Firestore updated (no API key stored)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'shopify.storeDomain': 'my-store.myshopify.com',
      }),
    );
  });

  it('rejects invalid store domain', async () => {
    await expect(
      connectShopifyHandler(
        makeRequest({
          storeDomain: 'not-a-valid-domain',
          adminApiKey: 'shpat_test',
        }),
      ),
    ).rejects.toThrow();
  });

  it('rejects if Shopify credentials are invalid', async () => {
    mockValidate.mockRejectedValue(new Error('Invalid Shopify API credentials'));

    await expect(
      connectShopifyHandler(
        makeRequest({
          storeDomain: 'my-store.myshopify.com',
          adminApiKey: 'shpat_bad',
        }),
      ),
    ).rejects.toThrow('Invalid Shopify API credentials');
  });

  it('rejects non-tenant-admin users', async () => {
    await expect(
      connectShopifyHandler({
        data: {
          storeDomain: 'my-store.myshopify.com',
          adminApiKey: 'shpat_test',
        },
        auth: { uid: 'u-1', token: { role: 'tenant_user', tenantId: 't-1' } },
        rawRequest: {},
      } as unknown as CallableRequest),
    ).rejects.toThrow('Forbidden');
  });
});

// ─── syncShopifyProductsHandler ───────────────────────────

describe('syncShopifyProductsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMockDb(
    tenantData: Record<string, unknown>,
    existingProducts: Array<{ id: string; data: () => Record<string, unknown> }> = [],
  ) {
    const mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => tenantData,
        }),
        update: vi.fn().mockResolvedValue(undefined),
      }),
      collection: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: existingProducts }),
        doc: vi.fn().mockReturnValue({ id: 'new-product-id' }),
      }),
      batch: vi.fn().mockReturnValue(mockBatch),
    });

    return mockBatch;
  }

  it('fetches products from Shopify and upserts to Firestore', async () => {
    const mockBatch = setupMockDb({
      shopify: { storeDomain: 'my-store.myshopify.com' },
    });

    mockGetSecret.mockResolvedValue('shpat_access_token');
    mockFetchProducts.mockResolvedValue([
      {
        shopifyProductId: 'gid://shopify/Product/1',
        title: 'Summer Dress',
        description: 'A nice dress',
        productType: 'Dress',
        vendor: 'Brand',
        images: [],
        variants: [],
        status: 'active',
      },
      {
        shopifyProductId: 'gid://shopify/Product/2',
        title: 'Winter Coat',
        description: 'A warm coat',
        productType: 'Coat',
        vendor: 'Brand',
        images: [],
        variants: [],
        status: 'active',
      },
    ]);

    const result = await syncShopifyProductsHandler(makeRequest());

    expect(result.success).toBe(true);
    expect(result.synced).toBe(2);
    expect(result.archived).toBe(0);

    expect(mockFetchProducts).toHaveBeenCalledWith(
      'my-store.myshopify.com',
      'shpat_access_token',
    );

    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('archives products no longer in Shopify', async () => {
    const mockBatch = setupMockDb(
      { shopify: { storeDomain: 'my-store.myshopify.com' } },
      [
        {
          id: 'existing-1',
          data: () => ({ shopifyProductId: 'gid://shopify/Product/old' }),
        },
      ],
    );

    mockGetSecret.mockResolvedValue('shpat_token');
    mockFetchProducts.mockResolvedValue([
      {
        shopifyProductId: 'gid://shopify/Product/new',
        title: 'New Product',
        description: '',
        productType: '',
        vendor: '',
        images: [],
        variants: [],
        status: 'active',
      },
    ]);

    const result = await syncShopifyProductsHandler(makeRequest());

    expect(result.synced).toBe(1);
    expect(result.archived).toBe(1);

    // Should batch.update the old product to archived
    expect(mockBatch.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'archived' }),
    );
  });

  it('throws if Shopify is not connected', async () => {
    setupMockDb({ shopify: { storeDomain: null } });

    await expect(syncShopifyProductsHandler(makeRequest())).rejects.toThrow(
      'Shopify is not connected',
    );
  });

  it('throws if API key is missing from Secret Manager', async () => {
    setupMockDb({ shopify: { storeDomain: 'my-store.myshopify.com' } });
    mockGetSecret.mockRejectedValue(new Error('not found'));

    await expect(syncShopifyProductsHandler(makeRequest())).rejects.toThrow(
      'Shopify API key not found',
    );
  });

  it('throws if tenant not found', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    });

    await expect(syncShopifyProductsHandler(makeRequest())).rejects.toThrow(
      'Tenant not found',
    );
  });
});

// ─── disconnectShopifyHandler ─────────────────────────────

describe('disconnectShopifyHandler', () => {
  it('clears shopify config on tenant', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({ update: mockUpdate }),
    });

    const result = await disconnectShopifyHandler(makeRequest());

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'shopify.storeDomain': null,
        'shopify.connectedAt': null,
        'shopify.lastSyncAt': null,
      }),
    );
  });
});

// ─── listProductsHandler ──────────────────────────────────

describe('listProductsHandler', () => {
  it('returns all products for the tenant', async () => {
    const mockDocs = [
      { id: 'p-1', data: () => ({ title: 'Dress A' }) },
      { id: 'p-2', data: () => ({ title: 'Dress B' }) },
    ];

    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: mockDocs }),
        }),
      }),
    });

    const result = await listProductsHandler(makeRequest());

    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toEqual({ id: 'p-1', title: 'Dress A' });
  });
});
