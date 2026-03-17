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

vi.mock('../../services/cloud-tasks', () => ({
  computeScheduleTime: vi.fn(),
  computePhotoshootImageCount: vi.fn(),
  enqueuePhotoshootTask: vi.fn(),
}));

vi.mock('../../services/gemini-service', () => ({
  generateImage: vi.fn(),
}));

import { createPhotoshootHandler, processPhotoshootWorker } from '../photoshoot';
import { getDb, getStorage } from '../../services/firebase-admin';
import { reserveCredits, refundCreditsForFailure } from '../../services/credit-service';
import { computeScheduleTime, computePhotoshootImageCount, enqueuePhotoshootTask } from '../../services/cloud-tasks';
import { generateImage } from '../../services/gemini-service';
import { makeTenantAdminClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;
const mockGetStorage = getStorage as ReturnType<typeof vi.fn>;
const mockReserveCredits = reserveCredits as ReturnType<typeof vi.fn>;
const mockRefundCredits = refundCreditsForFailure as ReturnType<typeof vi.fn>;
const mockComputeSchedule = computeScheduleTime as ReturnType<typeof vi.fn>;
const mockComputeImages = computePhotoshootImageCount as ReturnType<typeof vi.fn>;
const mockEnqueue = enqueuePhotoshootTask as ReturnType<typeof vi.fn>;
const mockGenerateImage = generateImage as ReturnType<typeof vi.fn>;

function makeRequest(data: Record<string, unknown> = {}): CallableRequest {
  return {
    data,
    auth: { uid: 'user-uid-1', token: makeTenantAdminClaims() },
    rawRequest: {},
  } as unknown as CallableRequest;
}

function setupMockDb() {
  const mockPhotoshootRef = {
    id: 'ps-1',
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };

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
      if (path.includes('photoshoots/ps-1')) {
        return {
          ...mockPhotoshootRef,
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              name: 'Test Shoot',
              modelIds: ['m-1'],
              backgroundIds: ['bg-1'],
              productIds: [],
              itemImageUrls: ['https://example.com/item.jpg'],
              resolution: '1k',
              aspectRatio: '1:1',
              variantCount: 2,
              brief: 'Test brief',
              isOvernight: false,
              scheduledFor: null,
              totalCreditsEstimate: 6,
            }),
          }),
        };
      }
      if (path.includes('artDirectionModels')) {
        return {
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: 'm-1',
            data: () => ({ name: 'Model A', gender: 'female', skinColour: 'medium', hairColour: 'brown', height: '170cm', clothingSize: 12, age: '25-30' }),
          }),
        };
      }
      if (path.includes('artDirectionBackgrounds')) {
        return {
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: 'bg-1',
            data: () => ({ name: 'Studio', type: 'studio', description: 'White studio' }),
          }),
        };
      }
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
      // tenant doc
      return {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            artDirection: { defaultBrief: 'Brand', quickGenBrief: '', shopifyGenBrief: '', photoshootBrief: 'Photoshoot style' },
          }),
        }),
      };
    }),
    collection: vi.fn().mockImplementation((path: string) => {
      if (path.includes('photoshoots')) return { doc: vi.fn().mockReturnValue(mockPhotoshootRef) };
      if (path.includes('generationJobs')) return { doc: vi.fn().mockReturnValue(mockJobRef) };
      if (path.includes('generatedImages')) return { doc: mockImageDoc };
      return { doc: vi.fn() };
    }),
  });

  const mockFile = { save: vi.fn().mockResolvedValue(undefined) };
  mockGetStorage.mockReturnValue({
    bucket: vi.fn().mockReturnValue({ file: vi.fn().mockReturnValue(mockFile) }),
  });

  return { mockPhotoshootRef, mockJobRef, mockFile };
}

describe('createPhotoshootHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid input (missing name)', async () => {
    await expect(
      createPhotoshootHandler(makeRequest({ modelIds: ['m-1'], backgroundIds: ['bg-1'], resolution: '1k', aspectRatio: '1:1', variantCount: 1 })),
    ).rejects.toThrow();
  });

  it('rejects when no models selected', async () => {
    await expect(
      createPhotoshootHandler(makeRequest({
        name: 'Test', modelIds: [], backgroundIds: ['bg-1'],
        resolution: '1k', aspectRatio: '1:1', variantCount: 1,
      })),
    ).rejects.toThrow();
  });

  it('reserves credits and enqueues task for immediate photoshoot', async () => {
    setupMockDb();
    mockComputeSchedule.mockReturnValue(null);
    mockComputeImages.mockReturnValue(6);
    mockReserveCredits.mockResolvedValue('ledger-1');
    mockEnqueue.mockResolvedValue('task-name-1');

    const result = await createPhotoshootHandler(makeRequest({
      name: 'Spring Shoot',
      modelIds: ['m-1'],
      backgroundIds: ['bg-1'],
      productIds: [],
      itemImageUrls: [],
      resolution: '1k',
      aspectRatio: '1:1',
      variantCount: 2,
      brief: 'Spring vibes',
      isOvernight: false,
    }));

    expect(mockReserveCredits).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Number),
      'debit_photoshoot',
      expect.stringContaining('Spring Shoot'),
      'ps-1',
      'user-uid-1',
    );
    expect(mockEnqueue).toHaveBeenCalled();
    expect(result.photoshootId).toBe('ps-1');
    expect(result.status).toBe('processing');
  });

  it('schedules overnight photoshoot with deferred task', async () => {
    setupMockDb();
    mockComputeSchedule.mockReturnValue('2025-02-01T02:00:00.000Z');
    mockComputeImages.mockReturnValue(6);
    mockReserveCredits.mockResolvedValue('ledger-1');
    mockEnqueue.mockResolvedValue('task-name-1');

    const result = await createPhotoshootHandler(makeRequest({
      name: 'Overnight Shoot',
      modelIds: ['m-1'],
      backgroundIds: ['bg-1'],
      productIds: [],
      itemImageUrls: [],
      resolution: '1k',
      aspectRatio: '1:1',
      variantCount: 2,
      brief: '',
      isOvernight: true,
    }));

    expect(result.status).toBe('scheduled');
    expect(result.scheduledFor).toBe('2025-02-01T02:00:00.000Z');
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ photoshootId: 'ps-1' }),
      '2025-02-01T02:00:00.000Z',
    );
  });

  it('throws on insufficient credits', async () => {
    setupMockDb();
    mockComputeSchedule.mockReturnValue(null);
    mockComputeImages.mockReturnValue(6);
    mockReserveCredits.mockRejectedValue(new Error('Insufficient credits'));

    await expect(
      createPhotoshootHandler(makeRequest({
        name: 'Broke Shoot',
        modelIds: ['m-1'],
        backgroundIds: ['bg-1'],
        productIds: [],
        itemImageUrls: [],
        resolution: '1k',
        aspectRatio: '1:1',
        variantCount: 1,
        brief: '',
        isOvernight: false,
      })),
    ).rejects.toThrow('Insufficient credits');
  });
});

describe('processPhotoshootWorker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('processes all combinations and generates images', async () => {
    setupMockDb();
    mockGenerateImage.mockResolvedValue({
      imageBase64: 'aGVsbG8=',
      mimeType: 'image/png',
      promptTokens: 100,
      finishReason: 'STOP',
    });

    const result = await processPhotoshootWorker({
      photoshootId: 'ps-1',
      tenantId: 'tenant-1',
      createdBy: 'user-uid-1',
    });

    // 1 model × 1 background × 1 product/url × 2 variants = 2 images
    expect(result.completedImages).toBe(2);
    expect(result.failedImages).toBe(0);
    expect(mockGenerateImage).toHaveBeenCalledTimes(2);
  });

  it('refunds credits for failed images in bulk (Commit-or-Refund)', async () => {
    setupMockDb();
    // First succeeds, second fails
    mockGenerateImage
      .mockResolvedValueOnce({
        imageBase64: 'aGVsbG8=',
        mimeType: 'image/png',
        promptTokens: 100,
        finishReason: 'STOP',
      })
      .mockRejectedValueOnce(new Error('Gemini error'));

    mockRefundCredits.mockResolvedValue('refund-1');

    const result = await processPhotoshootWorker({
      photoshootId: 'ps-1',
      tenantId: 'tenant-1',
      createdBy: 'user-uid-1',
    });

    expect(result.completedImages).toBe(1);
    expect(result.failedImages).toBe(1);
    expect(mockRefundCredits).toHaveBeenCalledWith(
      'tenant-1',
      3, // 6 total / 2 images * 1 failed = 3
      'ps-1',
      'system',
    );
  });
});
