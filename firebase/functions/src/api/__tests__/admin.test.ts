import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
  getAuth: vi.fn(),
}));

import {
  listTenantsHandler,
  getCreditCostsHandler,
  updateCreditCostsHandler,
} from '../admin';
import { getDb } from '../../services/firebase-admin';
import { makeAdminClaims } from '../../test/fixtures';

function makeRequest(
  data: Record<string, unknown> = {},
  token?: Record<string, unknown>,
): CallableRequest {
  return {
    data,
    auth: {
      uid: 'admin-uid-1',
      token: token ?? makeAdminClaims(),
    },
    rawRequest: {},
  } as unknown as CallableRequest;
}

describe('listTenantsHandler', () => {
  it('returns all tenants ordered by createdAt desc', async () => {
    const mockDocs = [
      { id: 't-1', data: () => ({ name: 'Tenant A' }) },
      { id: 't-2', data: () => ({ name: 'Tenant B' }) },
    ];

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: mockDocs,
          }),
        }),
      }),
    });

    const result = await listTenantsHandler(makeRequest());

    expect(result.tenants).toHaveLength(2);
    expect(result.tenants[0]).toEqual({ id: 't-1', name: 'Tenant A' });
    expect(result.tenants[1]).toEqual({ id: 't-2', name: 'Tenant B' });
  });

  it('rejects non-admin users', async () => {
    await expect(
      listTenantsHandler({
        data: {},
        auth: { uid: 'u-1', token: { role: 'tenant_user' } },
        rawRequest: {},
      } as unknown as CallableRequest),
    ).rejects.toThrow('Forbidden');
  });
});

describe('getCreditCostsHandler', () => {
  it('returns platform config', async () => {
    const configData = {
      creditCosts: { quickGen1k: 5 },
      aspectRatios: ['1:1'],
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => configData }),
      }),
    });

    const result = await getCreditCostsHandler(makeRequest());
    expect(result).toEqual(configData);
  });

  it('throws if config does not exist', async () => {
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    });

    await expect(getCreditCostsHandler(makeRequest())).rejects.toThrow(
      'Platform config not found',
    );
  });
});

describe('updateCreditCostsHandler', () => {
  it('updates credit costs with valid input', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue({
      doc: vi.fn().mockReturnValue({ update: mockUpdate }),
    });

    const validCosts = {
      quickGen1k: 5,
      quickGen2k: 10,
      shopifyGen1k: 5,
      shopifyGen2k: 10,
      photoshoot1k: 3,
      photoshoot2k: 7,
      modelGeneration: 2,
      backgroundGeneration: 2,
      videoGeneration: 15,
    };

    const result = await updateCreditCostsHandler(makeRequest(validCosts));

    expect(result.success).toBe(true);
    expect(result.creditCosts).toEqual(validCosts);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ creditCosts: validCosts }),
    );
  });

  it('rejects invalid costs (zero value)', async () => {
    await expect(
      updateCreditCostsHandler(
        makeRequest({
          quickGen1k: 0,
          quickGen2k: 10,
          shopifyGen1k: 5,
          shopifyGen2k: 10,
          photoshoot1k: 3,
          photoshoot2k: 7,
          modelGeneration: 2,
          backgroundGeneration: 2,
          videoGeneration: 15,
        }),
      ),
    ).rejects.toThrow();
  });

  it('rejects non-admin users', async () => {
    await expect(
      updateCreditCostsHandler({
        data: {},
        auth: { uid: 'u-1', token: { role: 'tenant_admin', tenantId: 't-1' } },
        rawRequest: {},
      } as unknown as CallableRequest),
    ).rejects.toThrow('Forbidden');
  });
});
