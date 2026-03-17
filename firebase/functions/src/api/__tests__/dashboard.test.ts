import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
}));

import { getTenantDashboardHandler } from '../dashboard';
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

describe('getTenantDashboardHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns aggregated dashboard stats', async () => {
    const imageDocs = [
      { data: () => ({ status: 'approved' }) },
      { data: () => ({ status: 'waiting_approval' }) },
      { data: () => ({ status: 'rejected' }) },
      { data: () => ({ status: 'approved' }) },
    ];

    const productDocs = [{ id: 'p-1' }, { id: 'p-2' }];

    const ledgerDocs = [
      {
        id: 'l-1',
        data: () => ({
          type: 'topup_admin',
          amount: 500,
          description: 'Trial',
          createdAt: '2025-01-01T00:00:00Z',
        }),
      },
    ];

    const mockDoc = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ creditBalance: 750 }),
      }),
    });

    const mockCollection = vi.fn().mockImplementation((path: string) => {
      if (path.includes('generatedImages')) {
        return { get: vi.fn().mockResolvedValue({ docs: imageDocs, size: 4 }) };
      }
      if (path.includes('products')) {
        return {
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: productDocs, size: 2 }),
          }),
        };
      }
      if (path.includes('creditLedger')) {
        return {
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ docs: ledgerDocs }),
            }),
          }),
        };
      }
      return {};
    });

    mockGetDb.mockReturnValue({
      doc: mockDoc,
      collection: mockCollection,
    });

    const result = await getTenantDashboardHandler(makeRequest());

    expect(result.creditBalance).toBe(750);
    expect(result.totalGenerated).toBe(4);
    expect(result.approvedImages).toBe(2);
    expect(result.pendingImages).toBe(1);
    expect(result.rejectedImages).toBe(1);
    expect(result.totalProducts).toBe(2);
    expect(result.recentLedger).toHaveLength(1);
    expect(result.recentLedger[0].type).toBe('topup_admin');
  });

  it('throws if tenant not found', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    });

    await expect(getTenantDashboardHandler(makeRequest())).rejects.toThrow(
      'Tenant not found',
    );
  });
});
