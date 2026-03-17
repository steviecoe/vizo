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

vi.mock('../../services/veo-service', () => ({
  generateVideo: vi.fn(),
}));

import { generateVideoHandler } from '../video';
import { getDb, getStorage } from '../../services/firebase-admin';
import { reserveCredits, refundCreditsForFailure } from '../../services/credit-service';
import { generateVideo } from '../../services/veo-service';
import { makeTenantUserClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;
const mockGetStorage = getStorage as ReturnType<typeof vi.fn>;
const mockReserveCredits = reserveCredits as ReturnType<typeof vi.fn>;
const mockRefundCredits = refundCreditsForFailure as ReturnType<typeof vi.fn>;
const mockGenerateVideo = generateVideo as ReturnType<typeof vi.fn>;

function makeRequest(data: Record<string, unknown> = {}): CallableRequest {
  return {
    data,
    auth: { uid: 'user-uid-1', token: makeTenantUserClaims() },
    rawRequest: {},
  } as unknown as CallableRequest;
}

function setupMockDb(imageStatus = 'approved') {
  const mockVideoRef = {
    id: 'video-1',
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };

  mockGetDb.mockReturnValue({
    doc: vi.fn().mockImplementation((path: string) => {
      if (path.includes('generatedImages')) {
        return {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              status: imageStatus,
              storageUrl: 'tenants/tenant-1/generated/img-1/full.png',
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
                quickGen1k: 5, quickGen2k: 10, shopifyGen1k: 5,
                shopifyGen2k: 10, photoshoot1k: 3, photoshoot2k: 7,
                modelGeneration: 2, backgroundGeneration: 2, videoGeneration: 15,
              },
            }),
          }),
        };
      }
      return { get: vi.fn().mockResolvedValue({ exists: false }) };
    }),
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue(mockVideoRef),
    }),
  });

  const mockFile = {
    download: vi.fn().mockResolvedValue([Buffer.from('fake-image-data')]),
    save: vi.fn().mockResolvedValue(undefined),
  };

  mockGetStorage.mockReturnValue({
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue(mockFile),
    }),
  });

  return { mockVideoRef, mockFile };
}

describe('generateVideoHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates video from approved image', async () => {
    const { mockVideoRef } = setupMockDb('approved');
    mockReserveCredits.mockResolvedValue('ledger-1');
    mockGenerateVideo.mockResolvedValue({
      videoBase64: 'dmlkZW8tZGF0YQ==',
      mimeType: 'video/mp4',
      durationSeconds: 4,
    });

    const result = await generateVideoHandler(makeRequest({ imageId: 'img-1' }));

    expect(result.videoId).toBe('video-1');
    expect(result.status).toBe('completed');
    expect(result.creditsCost).toBe(15);
    expect(result.durationSeconds).toBe(4);
    expect(result.ledgerEntryId).toBe('ledger-1');

    expect(mockReserveCredits).toHaveBeenCalledWith(
      'tenant-1',
      15,
      'debit_video',
      expect.stringContaining('img-1'),
      'video-1',
      'user-uid-1',
    );

    // Verify video doc was set
    expect(mockVideoRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceImageId: 'img-1',
        status: 'pending',
        creditsCharged: 15,
      }),
    );

    // Verify video doc updated to processing then completed
    expect(mockVideoRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing' }),
    );
    expect(mockVideoRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        storageUrl: 'tenants/tenant-1/videos/video-1.mp4',
        durationSeconds: 4,
      }),
    );
  });

  it('rejects non-approved images', async () => {
    setupMockDb('waiting_approval');

    await expect(
      generateVideoHandler(makeRequest({ imageId: 'img-1' })),
    ).rejects.toThrow('Only approved images can be converted to video');
  });

  it('refunds credits on generation failure', async () => {
    setupMockDb('approved');
    mockReserveCredits.mockResolvedValue('ledger-1');
    mockGenerateVideo.mockRejectedValue(new Error('Veo API timeout'));
    mockRefundCredits.mockResolvedValue('refund-1');

    const result = await generateVideoHandler(makeRequest({ imageId: 'img-1' }));

    expect(result.status).toBe('failed');
    expect(result.creditsRefunded).toBe(15);
    expect(result.error).toBe('Veo API timeout');
    expect(result.refundLedgerEntryId).toBe('refund-1');

    expect(mockRefundCredits).toHaveBeenCalledWith(
      'tenant-1',
      15,
      'video-1',
      'user-uid-1',
    );
  });

  it('rejects invalid input (missing imageId)', async () => {
    await expect(
      generateVideoHandler(makeRequest({})),
    ).rejects.toThrow();
  });

  it('throws when image not found', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    });

    await expect(
      generateVideoHandler(makeRequest({ imageId: 'nonexistent' })),
    ).rejects.toThrow('Image not found');
  });

  it('marks video as failed when credits insufficient', async () => {
    const { mockVideoRef } = setupMockDb('approved');
    mockReserveCredits.mockRejectedValue(
      new Error('Insufficient credits: balance=5, required=15'),
    );

    await expect(
      generateVideoHandler(makeRequest({ imageId: 'img-1' })),
    ).rejects.toThrow('Insufficient credits');

    expect(mockVideoRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'Insufficient credits',
      }),
    );
  });
});
