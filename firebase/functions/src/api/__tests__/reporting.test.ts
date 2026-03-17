import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
}));

import { getReportingDataHandler } from '../reporting';
import { getDb } from '../../services/firebase-admin';
import { makeAdminClaims, makeTenantUserClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;

function makeRequest(claims = makeAdminClaims()): CallableRequest {
  return {
    data: {},
    auth: { uid: 'admin-uid-1', token: claims },
    rawRequest: {},
  } as unknown as CallableRequest;
}

describe('getReportingDataHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires admin role', async () => {
    await expect(
      getReportingDataHandler(makeRequest(makeTenantUserClaims())),
    ).rejects.toThrow('Forbidden');
  });

  it('aggregates data across all tenants', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ defaultPricePerCredit: 0.5 }),
        }),
      }),
      collection: vi.fn().mockImplementation((path: string) => {
        if (path === 'tenants') {
          return {
            get: vi.fn().mockResolvedValue({
              docs: [
                {
                  id: 't-1',
                  data: () => ({ name: 'Tenant A', creditBalance: 500 }),
                },
                {
                  id: 't-2',
                  data: () => ({ name: 'Tenant B', creditBalance: 300 }),
                },
              ],
            }),
          };
        }
        if (path.includes('generatedImages')) {
          return {
            get: vi.fn().mockResolvedValue({
              docs: [
                { data: () => ({ status: 'approved', resolution: '1k' }) },
                { data: () => ({ status: 'waiting_approval', resolution: '2k' }) },
              ],
            }),
          };
        }
        if (path.includes('generationJobs')) {
          return {
            get: vi.fn().mockResolvedValue({ size: 3 }),
          };
        }
        if (path.includes('creditLedger')) {
          return {
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  docs: [
                    {
                      data: () => ({
                        type: 'debit_generation',
                        amount: -10,
                        description: 'Quick gen',
                        createdAt: '2025-01-20T00:00:00Z',
                      }),
                    },
                  ],
                }),
              }),
            }),
          };
        }
        return { get: vi.fn().mockResolvedValue({ docs: [] }) };
      }),
    });

    const result = await getReportingDataHandler(makeRequest());

    expect(result.totalTenants).toBe(2);
    expect(result.totalCreditsInSystem).toBe(800); // 500 + 300
    // 2 tenants × 2 images each = 4 total
    expect(result.totalImagesGenerated).toBe(4);
    // 2 tenants × 1 approved each = 2 total
    expect(result.totalImagesApproved).toBe(2);
    expect(result.totalJobs).toBe(6); // 2 tenants × 3 each
    expect(result.topTenants).toHaveLength(2);
    expect(result.recentLedgerEntries.length).toBeGreaterThan(0);
    // AI cost fields
    expect(result.images1k).toBeDefined();
    expect(result.images2k).toBeDefined();
    expect(result.estimatedAiCost).toBeDefined();
    expect(result.creditsRevenue).toBeDefined();
    expect(result.profitMargin).toBeDefined();
  });

  it('handles empty platform (no tenants)', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
      collection: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
      }),
    });

    const result = await getReportingDataHandler(makeRequest());

    expect(result.totalTenants).toBe(0);
    expect(result.totalCreditsInSystem).toBe(0);
    expect(result.totalImagesGenerated).toBe(0);
    expect(result.topTenants).toEqual([]);
    expect(result.recentLedgerEntries).toEqual([]);
  });
});
