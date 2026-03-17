import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
  getStorage: vi.fn(),
}));

vi.mock('../../services/secret-manager', () => ({
  getSecret: vi.fn(),
  buildTenantShopifySecretName: vi.fn().mockReturnValue('tenant-1-shopify-api-key'),
}));

vi.mock('../../services/shopify-export-service', () => ({
  uploadImageToShopify: vi.fn(),
}));

// Mock archiver
vi.mock('archiver', () => ({
  create: vi.fn().mockReturnValue({
    pipe: vi.fn(),
    append: vi.fn(),
    finalize: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { pushImageToShopifyHandler, bulkDownloadImagesHandler } from '../exports';
import { getDb, getStorage } from '../../services/firebase-admin';
import { getSecret } from '../../services/secret-manager';
import { uploadImageToShopify } from '../../services/shopify-export-service';
import { makeTenantAdminClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;
const mockGetStorage = getStorage as ReturnType<typeof vi.fn>;
const mockGetSecret = getSecret as ReturnType<typeof vi.fn>;
const mockUpload = uploadImageToShopify as ReturnType<typeof vi.fn>;

function makeRequest(data: Record<string, unknown> = {}): CallableRequest {
  return {
    data,
    auth: { uid: 'user-uid-1', token: makeTenantAdminClaims() },
    rawRequest: {},
  } as unknown as CallableRequest;
}

describe('pushImageToShopifyHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects missing imageId', async () => {
    await expect(pushImageToShopifyHandler(makeRequest({}))).rejects.toThrow();
  });

  it('rejects non-approved image', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          ref: { update: vi.fn() },
          data: () => ({ status: 'waiting_approval', productId: 'p-1' }),
        }),
      }),
    });

    await expect(
      pushImageToShopifyHandler(makeRequest({ imageId: 'img-1' })),
    ).rejects.toThrow('Only approved images');
  });

  it('rejects image without linked product', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          ref: { update: vi.fn() },
          data: () => ({ status: 'approved', productId: null }),
        }),
      }),
    });

    await expect(
      pushImageToShopifyHandler(makeRequest({ imageId: 'img-1' })),
    ).rejects.toThrow('not linked to a product');
  });

  it('uploads approved image to Shopify and updates status', async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);

    mockGetDb.mockReturnValue({
      doc: vi.fn().mockImplementation((path: string) => {
        if (path.includes('generatedImages')) {
          return {
            get: vi.fn().mockResolvedValue({
              exists: true,
              ref: { update: updateFn },
              data: () => ({ status: 'approved', productId: 'p-1', storageUrl: 'path/to/image.png' }),
            }),
          };
        }
        if (path.includes('products')) {
          return {
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ shopifyProductId: 'gid://shopify/Product/123', title: 'Dress' }),
            }),
          };
        }
        // tenant doc
        return {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ shopify: { storeDomain: 'test.myshopify.com' } }),
          }),
        };
      }),
    });

    const mockBuffer = Buffer.from('fakepng');
    mockGetStorage.mockReturnValue({
      bucket: vi.fn().mockReturnValue({
        file: vi.fn().mockReturnValue({
          download: vi.fn().mockResolvedValue([mockBuffer]),
        }),
      }),
    });

    mockGetSecret.mockResolvedValue('shpat_secret');
    mockUpload.mockResolvedValue({
      shopifyImageId: 'shopify-img-1',
      src: 'https://cdn.shopify.com/img.png',
    });

    const result = await pushImageToShopifyHandler(makeRequest({ imageId: 'img-1' }));

    expect(result.success).toBe(true);
    expect(result.shopifyImageId).toBe('shopify-img-1');
    expect(mockUpload).toHaveBeenCalledWith(
      'test.myshopify.com',
      'shpat_secret',
      'gid://shopify/Product/123',
      expect.any(String), // base64
      'vizo-img-1.png',
      expect.stringContaining('Dress'),
    );
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ shopifyExportStatus: 'exported' }),
    );
  });
});

describe('bulkDownloadImagesHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects empty imageIds', async () => {
    await expect(
      bulkDownloadImagesHandler(makeRequest({ imageIds: [] })),
    ).rejects.toThrow();
  });

  it('rejects when no approved images found', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ status: 'waiting_approval', storageUrl: 'path.png' }),
        }),
      }),
    });
    mockGetStorage.mockReturnValue({
      bucket: vi.fn().mockReturnValue({ file: vi.fn() }),
    });

    await expect(
      bulkDownloadImagesHandler(makeRequest({ imageIds: ['img-1'] })),
    ).rejects.toThrow('No approved images');
  });
});
