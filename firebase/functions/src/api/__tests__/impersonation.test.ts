import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
  getAuth: vi.fn(),
}));

import { impersonateHandler, endImpersonationHandler } from '../impersonation';
import { getDb, getAuth } from '../../services/firebase-admin';
import { makeAdminClaims, makeImpersonationClaims } from '../../test/fixtures';

function createMockFirestore() {
  const mockDocGet = vi.fn();
  const mockAdd = vi.fn().mockResolvedValue({ id: 'audit-1' });

  return {
    db: {
      doc: vi.fn().mockReturnValue({ get: mockDocGet }),
      collection: vi.fn().mockReturnValue({ add: mockAdd }),
    } as unknown as FirebaseFirestore.Firestore,
    mockDocGet,
    mockAdd,
  };
}

function createMockAuth() {
  return {
    createCustomToken: vi.fn().mockResolvedValue('mock-custom-token'),
  };
}

describe('impersonateHandler', () => {
  let mockFirestore: ReturnType<typeof createMockFirestore>;
  let mockAuth: ReturnType<typeof createMockAuth>;

  beforeEach(() => {
    mockFirestore = createMockFirestore();
    mockAuth = createMockAuth();

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockFirestore.db);
    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue(mockAuth);
  });

  function makeRequest(data: Record<string, unknown>, token?: Record<string, unknown>): CallableRequest {
    return {
      data,
      auth: {
        uid: 'admin-uid-1',
        token: token ?? makeAdminClaims(),
      },
      rawRequest: {},
    } as unknown as CallableRequest;
  }

  it('mints a custom token with impersonation claims', async () => {
    mockFirestore.mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: 'Test Tenant' }),
    });

    const result = await impersonateHandler(
      makeRequest({ targetTenantId: 'tenant-1' }),
    );

    expect(result.customToken).toBe('mock-custom-token');
    expect(result.tenantName).toBe('Test Tenant');
    expect(result.tenantId).toBe('tenant-1');

    expect(mockAuth.createCustomToken).toHaveBeenCalledWith('admin-uid-1', {
      role: 'vg_admin',
      impersonating: true,
      impersonatedTenantId: 'tenant-1',
      originalUid: 'admin-uid-1',
    });
  });

  it('logs an audit trail entry', async () => {
    mockFirestore.mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: 'Test Tenant' }),
    });

    await impersonateHandler(
      makeRequest({ targetTenantId: 'tenant-1' }, { ...makeAdminClaims(), email: 'admin@vg.com' }),
    );

    expect(mockFirestore.mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'impersonation_start',
        adminUid: 'admin-uid-1',
        targetTenantId: 'tenant-1',
        targetTenantName: 'Test Tenant',
      }),
    );
  });

  it('rejects missing targetTenantId', async () => {
    await expect(
      impersonateHandler(makeRequest({})),
    ).rejects.toThrow('targetTenantId is required');
  });

  it('rejects non-existent tenant', async () => {
    mockFirestore.mockDocGet.mockResolvedValue({ exists: false });

    await expect(
      impersonateHandler(makeRequest({ targetTenantId: 'nonexistent' })),
    ).rejects.toThrow('not found');
  });

  it('rejects non-admin users', async () => {
    await expect(
      impersonateHandler({
        data: { targetTenantId: 'tenant-1' },
        auth: { uid: 'user-1', token: { role: 'tenant_user', tenantId: 'x' } },
        rawRequest: {},
      } as unknown as CallableRequest),
    ).rejects.toThrow('Forbidden');
  });
});

describe('endImpersonationHandler', () => {
  let mockFirestore: ReturnType<typeof createMockFirestore>;
  let mockAuth: ReturnType<typeof createMockAuth>;

  beforeEach(() => {
    mockFirestore = createMockFirestore();
    mockAuth = createMockAuth();

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockFirestore.db);
    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue(mockAuth);
  });

  it('mints a clean admin token', async () => {
    const result = await endImpersonationHandler({
      data: {},
      auth: {
        uid: 'admin-uid-1',
        token: makeImpersonationClaims(),
      },
      rawRequest: {},
    } as unknown as CallableRequest);

    expect(result.customToken).toBe('mock-custom-token');
    expect(mockAuth.createCustomToken).toHaveBeenCalledWith('admin-uid-1', {
      role: 'vg_admin',
    });
  });

  it('logs audit trail for end', async () => {
    await endImpersonationHandler({
      data: {},
      auth: {
        uid: 'admin-uid-1',
        token: { ...makeImpersonationClaims(), email: 'admin@vg.com' },
      },
      rawRequest: {},
    } as unknown as CallableRequest);

    expect(mockFirestore.mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'impersonation_end',
        adminUid: 'admin-uid-1',
      }),
    );
  });

  it('rejects unauthenticated requests', async () => {
    await expect(
      endImpersonationHandler({
        data: {},
        auth: null,
        rawRequest: {},
      } as unknown as CallableRequest),
    ).rejects.toThrow('Authentication required');
  });

  it('rejects if not currently impersonating', async () => {
    await expect(
      endImpersonationHandler({
        data: {},
        auth: {
          uid: 'admin-uid-1',
          token: makeAdminClaims(),
        },
        rawRequest: {},
      } as unknown as CallableRequest),
    ).rejects.toThrow('Not currently impersonating');
  });
});
