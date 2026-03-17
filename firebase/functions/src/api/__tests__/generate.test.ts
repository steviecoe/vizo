import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
  getStorage: vi.fn(),
}));

vi.mock('../../services/credit-service', () => ({
  reserveCredits: vi.fn(),
  refundCreditsForFailure: vi.fn(),
}));

vi.mock('../../services/generation-router', () => ({
  generateWithFallback: vi.fn(),
}));

import { quickGenerateHandler } from '../generate';
import { getDb, getStorage } from '../../services/firebase-admin';
import { reserveCredits, refundCreditsForFailure } from '../../services/credit-service';
import { generateWithFallback } from '../../services/generation-router';
import { makeTenantUserClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;
const mockGetStorage = getStorage as ReturnType<typeof vi.fn>;
const mockReserveCredits = reserveCredits as ReturnType<typeof vi.fn>;
const mockRefundCredits = refundCreditsForFailure as ReturnType<typeof vi.fn>;
const mockGenerateImage = generateWithFallback as ReturnType<typeof vi.fn>;

function makeRequest(data: Record<string, unknown> = {}): CallableRequest {
  return {
    data,
    auth: { uid: 'user-uid-1', token: makeTenantUserClaims() },
    rawRequest: {},
  } as unknown as CallableRequest;
}

function setupMockDb() {
  const mockJobRef = {
    id: 'job-1',
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };

  const mockImageDoc = vi.fn().mockReturnValue({
    id: 'img-1',
    set: vi.fn().mockResolvedValue(undefined),
  });

  mockGetDb.mockReturnValue({
    doc: vi.fn().mockImplementation((path: string) => {
      if (path.includes('generationJobs')) return mockJobRef;
      if (path.includes('artDirectionModels') || path.includes('artDirectionBackgrounds')) {
        return { get: vi.fn().mockResolvedValue({ exists: false }) };
      }
      if (path.includes('products')) {
        return { get: vi.fn().mockResolvedValue({ exists: false }) };
      }
      // tenant doc
      return {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            artDirection: { defaultBrief: 'Test', quickGenBrief: '', shopifyGenBrief: '', photoshootBrief: '' },
          }),
        }),
      };
    }),
    collection: vi.fn().mockImplementation((path: string) => {
      if (path.includes('generationJobs')) return { doc: vi.fn().mockReturnValue(mockJobRef) };
      if (path.includes('generatedImages')) return { doc: mockImageDoc };
      return { doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }) };
    }),
  });

  // Mock the second doc call for platform config
  const origDoc = mockGetDb().doc;
  mockGetDb.mockReturnValue({
    ...mockGetDb(),
    doc: vi.fn().mockImplementation((path: string) => {
      if (path.includes('platform/config')) {
        return {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              creditCosts: {
                quickGen1k: 5, quickGen2k: 10, shopifyGen1k: 5,
                shopifyGen2k: 10, photoshoot1k: 3, photoshoot2k: 7,
                modelGeneration: 2, backgroundGeneration: 2, videoGeneration: 15,
              },
            }),
          }),
        };
      }
      return origDoc(path);
    }),
  });

  const mockFile = { save: vi.fn().mockResolvedValue(undefined) };
  mockGetStorage.mockReturnValue({
    bucket: vi.fn().mockReturnValue({ file: vi.fn().mockReturnValue(mockFile) }),
  });

  return { mockJobRef, mockImageDoc, mockFile };
}

describe('quickGenerateHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid input', async () => {
    await expect(
      quickGenerateHandler(makeRequest({ params: { resolution: 'invalid' } })),
    ).rejects.toThrow();
  });

  it('rejects when no product or item image provided', async () => {
    await expect(
      quickGenerateHandler(
        makeRequest({
          params: {
            resolution: '1k',
            aspectRatio: '1:1',
            variantCount: 1,
            brief: '',
            modelIds: [],
            backgroundIds: [],
            productIds: [],
            itemImageUrls: [],
          },
        }),
      ),
    ).rejects.toThrow('At least one item image or product');
  });

  it('reserves credits before generation (Commit-or-Refund)', async () => {
    setupMockDb();
    mockReserveCredits.mockResolvedValue('ledger-1');
    mockGenerateImage.mockResolvedValue({
      imageBase64: 'aGVsbG8=',
      mimeType: 'image/png',
      promptTokens: 100,
      finishReason: 'STOP',
      modelUsed: 'gemini',
      usedFallback: false,
    });

    const result = await quickGenerateHandler(
      makeRequest({
        params: {
          resolution: '1k',
          aspectRatio: '1:1',
          variantCount: 1,
          brief: 'Test',
          modelIds: [],
          backgroundIds: [],
          productIds: [],
          itemImageUrls: ['https://example.com/item.jpg'],
        },
      }),
    );

    // Credits reserved BEFORE generation
    expect(mockReserveCredits).toHaveBeenCalledWith(
      'tenant-1',
      5, // quickGen1k = 5 * 1 variant
      'debit_generation',
      expect.any(String),
      'job-1',
      'user-uid-1',
    );

    expect(result.completedImages).toBe(1);
    expect(result.creditsCost).toBe(5);
    expect(result.ledgerEntryId).toBe('ledger-1');
  });

  it('refunds credits for failed images', async () => {
    setupMockDb();
    mockReserveCredits.mockResolvedValue('ledger-1');
    // First image succeeds, second fails
    mockGenerateImage
      .mockResolvedValueOnce({
        imageBase64: 'aGVsbG8=',
        mimeType: 'image/png',
        promptTokens: 100,
        finishReason: 'STOP',
        modelUsed: 'gemini',
        usedFallback: false,
      })
      .mockRejectedValueOnce(new Error('Generation failed on both models'));

    mockRefundCredits.mockResolvedValue('refund-1');

    const result = await quickGenerateHandler(
      makeRequest({
        params: {
          resolution: '1k',
          aspectRatio: '1:1',
          variantCount: 2,
          brief: '',
          modelIds: [],
          backgroundIds: [],
          productIds: [],
          itemImageUrls: ['https://example.com/item.jpg'],
        },
      }),
    );

    expect(result.completedImages).toBe(1);
    expect(result.failedImages).toBe(1);
    expect(result.creditsRefunded).toBe(5); // 10 total / 2 variants * 1 failed = 5
    expect(mockRefundCredits).toHaveBeenCalledWith(
      'tenant-1',
      5,
      'job-1',
      'user-uid-1',
    );
  });

  it('throws when insufficient credits', async () => {
    setupMockDb();
    mockReserveCredits.mockRejectedValue(new Error('Insufficient credits: balance=2, required=5'));

    await expect(
      quickGenerateHandler(
        makeRequest({
          params: {
            resolution: '1k',
            aspectRatio: '1:1',
            variantCount: 1,
            brief: '',
            modelIds: [],
            backgroundIds: [],
            productIds: [],
            itemImageUrls: ['https://example.com/item.jpg'],
          },
        }),
      ),
    ).rejects.toThrow('Insufficient credits');
  });
});
