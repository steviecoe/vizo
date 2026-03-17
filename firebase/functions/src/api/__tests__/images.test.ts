import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
}));

import { listImagesHandler, updateImageStatusHandler } from '../images';
import { getDb } from '../../services/firebase-admin';
import { makeTenantUserClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;

function makeRequest(
  data: Record<string, unknown> = {},
  token?: Record<string, unknown>,
): CallableRequest {
  return {
    data,
    auth: {
      uid: 'user-uid-1',
      token: token ?? makeTenantUserClaims(),
    },
    rawRequest: {},
  } as unknown as CallableRequest;
}

describe('listImagesHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all images for a tenant', async () => {
    const mockDocs = [
      { id: 'img-1', data: () => ({ status: 'waiting_approval' }) },
      { id: 'img-2', data: () => ({ status: 'approved' }) },
    ];

    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: mockDocs }),
          }),
        }),
      }),
    });

    const result = await listImagesHandler(makeRequest({}));
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({ id: 'img-1', status: 'waiting_approval' });
  });

  it('filters by status when provided', async () => {
    const mockLimit = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: [] }),
    });
    const mockWhere = vi.fn().mockReturnValue({
      limit: mockLimit,
    });
    const mockOrderBy = vi.fn().mockReturnValue({
      where: mockWhere,
      limit: mockLimit,
    });

    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      }),
    });

    await listImagesHandler(makeRequest({ statusFilter: 'approved' }));

    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'approved');
  });
});

describe('updateImageStatusHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('batch-updates image statuses', async () => {
    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({ id: 'img-ref' }),
      }),
      batch: vi.fn().mockReturnValue(mockBatch),
    });

    const result = await updateImageStatusHandler(
      makeRequest({ imageIds: ['img-1', 'img-2'], status: 'approved' }),
    );

    expect(result.success).toBe(true);
    expect(result.updated).toBe(2);
    expect(mockBatch.update).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('rejects empty imageIds', async () => {
    await expect(
      updateImageStatusHandler(makeRequest({ imageIds: [], status: 'approved' })),
    ).rejects.toThrow('imageIds must be a non-empty array');
  });

  it('rejects invalid status', async () => {
    await expect(
      updateImageStatusHandler(
        makeRequest({ imageIds: ['img-1'], status: 'invalid' }),
      ),
    ).rejects.toThrow('status must be "approved" or "rejected"');
  });
});
