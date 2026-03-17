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

vi.mock('../../generation/prompt-orchestrator', () => ({
  assemblePrompt: vi.fn(),
}));

import { regenerateImageHandler } from '../regenerate';
import { getDb, getStorage } from '../../services/firebase-admin';
import { reserveCredits, refundCreditsForFailure } from '../../services/credit-service';
import { generateWithFallback } from '../../services/generation-router';
import { assemblePrompt } from '../../generation/prompt-orchestrator';
import { makeTenantAdminClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;
const mockGetStorage = getStorage as ReturnType<typeof vi.fn>;
const mockReserveCredits = reserveCredits as ReturnType<typeof vi.fn>;
const mockRefundCredits = refundCreditsForFailure as ReturnType<typeof vi.fn>;
const mockGenerateImage = generateWithFallback as ReturnType<typeof vi.fn>;
const mockAssemblePrompt = assemblePrompt as ReturnType<typeof vi.fn>;

function makeRequest(data: Record<string, unknown> = {}): CallableRequest {
  return {
    data,
    auth: { uid: 'user-uid-1', token: makeTenantAdminClaims() },
    rawRequest: {},
  } as unknown as CallableRequest;
}

function setupMockDb(overrides: {
  imageExists?: boolean;
  imageStatus?: string;
  jobExists?: boolean;
} = {}) {
  const { imageExists = true, imageStatus = 'approved', jobExists = true } = overrides;

  const mockJobRef = {
    id: 'regen-job-1',
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };

  const mockNewImageDoc = {
    id: 'new-img-1',
    set: vi.fn().mockResolvedValue(undefined),
  };

  const db = {
    doc: vi.fn().mockImplementation((path: string) => {
      if (path.includes('generatedImages/img-1')) {
        return {
          get: vi.fn().mockResolvedValue({
            exists: imageExists,
            data: () => ({
              jobId: 'original-job-1',
              status: imageStatus,
              modelId: 'model-1',
              backgroundId: 'bg-1',
              productId: null,
            }),
          }),
        };
      }
      if (path.includes('generationJobs/original-job-1')) {
        return {
          get: vi.fn().mockResolvedValue({
            exists: jobExists,
            data: () => ({
              type: 'quick',
              params: {
                resolution: '1k',
                aspectRatio: '1:1',
                modelIds: ['model-1'],
                backgroundIds: ['bg-1'],
                productIds: [],
                itemImageUrls: [],
                brief: 'Test brief',
              },
            }),
          }),
        };
      }
      if (path.includes('platform/config')) {
        return {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              creditCosts: {
                quickGen1k: 5,
                quickGen2k: 10,
                shopifyGen1k: 8,
                shopifyGen2k: 16,
                photoshoot1k: 10,
                photoshoot2k: 20,
                modelGeneration: 2,
                backgroundGeneration: 2,
                videoGeneration: 15,
              },
            }),
          }),
        };
      }
      if (path === 'tenants/tenant-1') {
        // tenant root doc (for art direction)
        return {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ artDirection: {} }),
          }),
        };
      }
      if (path.includes('artDirectionModels')) {
        return {
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: 'model-1',
            data: () => ({ name: 'Model 1', imageUrl: 'model.jpg' }),
          }),
        };
      }
      if (path.includes('artDirectionBackgrounds')) {
        return {
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: 'bg-1',
            data: () => ({ name: 'Background 1', imageUrl: 'bg.jpg' }),
          }),
        };
      }
      return {
        get: vi.fn().mockResolvedValue({ exists: false }),
      };
    }),
    collection: vi.fn().mockImplementation((path: string) => {
      if (path.includes('generationJobs')) {
        return { doc: vi.fn().mockReturnValue(mockJobRef) };
      }
      if (path.includes('generatedImages')) {
        return {
          doc: vi.fn().mockImplementation((id?: string) => {
            if (id) return mockNewImageDoc;
            return { id: 'new-img-1' };
          }),
        };
      }
      return { doc: vi.fn().mockReturnValue({ id: 'doc-1' }) };
    }),
  };

  mockGetDb.mockReturnValue(db);
  return { db, mockJobRef, mockNewImageDoc };
}

describe('regenerateImageHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects missing imageId', async () => {
    await expect(
      regenerateImageHandler(makeRequest({})),
    ).rejects.toThrow();
  });

  it('rejects non-existent image', async () => {
    setupMockDb({ imageExists: false });

    await expect(
      regenerateImageHandler(makeRequest({ imageId: 'img-1' })),
    ).rejects.toThrow('Image not found');
  });

  it('rejects images still waiting approval', async () => {
    setupMockDb({ imageStatus: 'waiting_approval' });

    await expect(
      regenerateImageHandler(makeRequest({ imageId: 'img-1' })),
    ).rejects.toThrow('Cannot regenerate images that are still waiting approval');
  });

  it('rejects when original job is missing', async () => {
    setupMockDb({ jobExists: false });

    await expect(
      regenerateImageHandler(makeRequest({ imageId: 'img-1' })),
    ).rejects.toThrow('Original generation job not found');
  });

  it('reserves credits and generates new image on success', async () => {
    const { mockJobRef } = setupMockDb();

    mockReserveCredits.mockResolvedValue(undefined);
    mockAssemblePrompt.mockReturnValue({
      textPrompt: 'Generated prompt',
      imageUrls: ['model.jpg'],
    });
    mockGenerateImage.mockResolvedValue({
      imageBase64: 'aW1hZ2VkYXRh',
      mimeType: 'image/png',
      promptTokens: 100,
      finishReason: 'STOP',
      modelUsed: 'gemini',
      usedFallback: false,
    });

    const mockFile = {
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockGetStorage.mockReturnValue({
      bucket: () => ({
        file: () => mockFile,
      }),
    });

    const result = await regenerateImageHandler(makeRequest({ imageId: 'img-1' }));

    expect(result.status).toBe('completed');
    expect(result.creditsCost).toBe(5); // quickGen1k
    expect(result.jobId).toBe('regen-job-1');

    expect(mockReserveCredits).toHaveBeenCalledWith(
      'tenant-1',
      5,
      'debit_generation',
      expect.stringContaining('img-1'),
      'regen-job-1',
      'user-uid-1',
    );

    expect(mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ textPrompt: 'Generated prompt' }),
    );

    expect(mockJobRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', completedImages: 1 }),
    );
  });

  it('refunds credits on generation failure', async () => {
    const { mockJobRef } = setupMockDb();

    mockReserveCredits.mockResolvedValue(undefined);
    mockAssemblePrompt.mockReturnValue({
      textPrompt: 'Generated prompt',
      imageUrls: [],
    });
    mockGenerateImage.mockRejectedValue(new Error('Gemini API error'));
    mockRefundCredits.mockResolvedValue(undefined);

    await expect(
      regenerateImageHandler(makeRequest({ imageId: 'img-1' })),
    ).rejects.toThrow('Regeneration failed: Gemini API error. Credits refunded.');

    expect(mockRefundCredits).toHaveBeenCalledWith(
      'tenant-1',
      5,
      'regen-job-1',
      'user-uid-1',
    );

    expect(mockJobRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', failedImages: 1 }),
    );
  });

  it('fails gracefully when credit reservation fails', async () => {
    setupMockDb();
    mockReserveCredits.mockRejectedValue(new Error('Insufficient credits'));

    await expect(
      regenerateImageHandler(makeRequest({ imageId: 'img-1' })),
    ).rejects.toThrow('Insufficient credits');
  });
});
