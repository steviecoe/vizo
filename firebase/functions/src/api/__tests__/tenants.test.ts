import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

// Mock firebase-admin services
vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
  getAuth: vi.fn(),
}));

// Mock secret manager
vi.mock('../../services/secret-manager', () => ({
  createOrUpdateSecret: vi.fn().mockResolvedValue(undefined),
  buildTenantGeminiSecretName: vi.fn((id: string) => `tenant-${id}-gemini-api-key`),
}));

import {
  createTenantHandler,
  updateTenantHandler,
  listTenantUsersHandler,
  inviteTenantUserHandler,
  removeTenantUserHandler,
  deleteTenantHandler,
} from '../tenants';
import { getDb, getAuth } from '../../services/firebase-admin';
import { createOrUpdateSecret } from '../../services/secret-manager';
import { makeAdminClaims } from '../../test/fixtures';

// ─── Mock factories ──────────────────────────────────

function createMockFirestore() {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockDocRef = { id: 'generated-tenant-id', set: mockSet };
  const mockGet = vi.fn();

  const mockCollection = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        get: mockGet,
      }),
    }),
    doc: vi.fn().mockReturnValue(mockDocRef),
  });

  const mockDoc = vi.fn().mockReturnValue({ set: mockSet });

  return {
    db: { collection: mockCollection, doc: mockDoc } as unknown as FirebaseFirestore.Firestore,
    mockGet,
    mockSet,
    mockDocRef,
    mockCollection,
    mockDoc,
  };
}

function createMockAuth() {
  return {
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
  };
}

function makeRequest(
  data: Record<string, unknown>,
  authOverrides?: Partial<{ uid: string; token: Record<string, unknown> }>,
): CallableRequest {
  return {
    data,
    auth: {
      uid: 'admin-uid-1',
      token: makeAdminClaims(),
      ...authOverrides,
    },
    rawRequest: {},
  } as unknown as CallableRequest;
}

const validTenantInput = {
  name: 'Fashion Brand Co',
  slug: 'fashion-brand-co',
  pricePerCredit: 0.5,
  allowedFeatures: {
    shopifyIntegration: true,
    photoshootMode: true,
    quickGeneration: true,
  },
  adminEmails: ['admin@brand.com'],
  geminiApiKey: 'test-gemini-key-123',
};

// ─── Tests ───────────────────────────────────────────

describe('createTenantHandler', () => {
  let mockFirestore: ReturnType<typeof createMockFirestore>;
  let mockAuth: ReturnType<typeof createMockAuth>;

  beforeEach(() => {
    mockFirestore = createMockFirestore();
    mockAuth = createMockAuth();

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockFirestore.db);
    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue(mockAuth);

    // Default: slug does not exist
    mockFirestore.mockGet.mockResolvedValue({ empty: true });

    // Default: user does not exist, create new
    mockAuth.getUserByEmail.mockRejectedValue(new Error('User not found'));
    mockAuth.createUser.mockResolvedValue({ uid: 'new-user-uid' });
  });

  it('creates a tenant with valid input', async () => {
    const result = await createTenantHandler(makeRequest(validTenantInput));

    expect(result.success).toBe(true);
    expect(result.tenantId).toBe('generated-tenant-id');
    expect(result.message).toContain('Fashion Brand Co');
    expect(result.message).toContain('1 admin(s)');
  });

  it('stores the Gemini API key in Secret Manager', async () => {
    await createTenantHandler(makeRequest(validTenantInput));

    expect(createOrUpdateSecret).toHaveBeenCalledWith(
      'tenant-generated-tenant-id-gemini-api-key',
      'test-gemini-key-123',
    );
  });

  it('does NOT store the Gemini API key in Firestore', async () => {
    await createTenantHandler(makeRequest(validTenantInput));

    // Check that the tenant document set call does not contain geminiApiKey
    const setCall = mockFirestore.mockDocRef.set.mock.calls[0][0];
    expect(setCall).not.toHaveProperty('geminiApiKey');
    expect(JSON.stringify(setCall)).not.toContain('test-gemini-key-123');
  });

  it('sets tenant document with correct fields', async () => {
    await createTenantHandler(makeRequest(validTenantInput));

    const setCall = mockFirestore.mockDocRef.set.mock.calls[0][0];
    expect(setCall.name).toBe('Fashion Brand Co');
    expect(setCall.slug).toBe('fashion-brand-co');
    expect(setCall.pricePerCredit).toBe(0.5);
    expect(setCall.creditBalance).toBe(0);
    expect(setCall.status).toBe('active');
    expect(setCall.allowedFeatures.shopifyIntegration).toBe(true);
  });

  it('rejects duplicate slugs', async () => {
    mockFirestore.mockGet.mockResolvedValue({ empty: false });

    await expect(
      createTenantHandler(makeRequest(validTenantInput)),
    ).rejects.toThrow('already exists');
  });

  it('rejects invalid input (missing name)', async () => {
    const badInput = { ...validTenantInput, name: '' };

    await expect(
      createTenantHandler(makeRequest(badInput)),
    ).rejects.toThrow();
  });

  it('rejects unauthenticated requests', async () => {
    const request = {
      data: validTenantInput,
      auth: null,
      rawRequest: {},
    } as unknown as CallableRequest;

    await expect(createTenantHandler(request)).rejects.toThrow(
      'Authentication required',
    );
  });

  it('rejects non-admin users', async () => {
    const request = {
      data: validTenantInput,
      auth: {
        uid: 'user-1',
        token: { role: 'tenant_user', tenantId: 'tenant-1' },
      },
      rawRequest: {},
    } as unknown as CallableRequest;

    await expect(createTenantHandler(request)).rejects.toThrow('Forbidden');
  });

  it('creates a new Firebase Auth user if email not found', async () => {
    mockAuth.getUserByEmail.mockRejectedValue(new Error('User not found'));
    mockAuth.createUser.mockResolvedValue({ uid: 'brand-new-uid' });

    await createTenantHandler(makeRequest(validTenantInput));

    expect(mockAuth.createUser).toHaveBeenCalledWith({
      email: 'admin@brand.com',
    });
  });

  it('reuses existing Firebase Auth user if email already exists', async () => {
    mockAuth.getUserByEmail.mockResolvedValue({ uid: 'existing-uid' });

    await createTenantHandler(makeRequest(validTenantInput));

    expect(mockAuth.createUser).not.toHaveBeenCalled();
    expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith(
      'existing-uid',
      expect.objectContaining({ role: 'tenant_admin' }),
    );
  });

  it('sets tenant_admin custom claims on invited users', async () => {
    mockAuth.createUser.mockResolvedValue({ uid: 'new-uid' });

    await createTenantHandler(makeRequest(validTenantInput));

    expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('new-uid', {
      role: 'tenant_admin',
      tenantId: 'generated-tenant-id',
    });
  });

  it('creates user document in tenant subcollection', async () => {
    mockAuth.createUser.mockResolvedValue({ uid: 'new-uid' });

    await createTenantHandler(makeRequest(validTenantInput));

    expect(mockFirestore.mockDoc).toHaveBeenCalledWith(
      'tenants/generated-tenant-id/users/new-uid',
    );
  });

  it('handles multiple admin emails', async () => {
    const input = {
      ...validTenantInput,
      adminEmails: ['admin1@brand.com', 'admin2@brand.com'],
    };

    mockAuth.createUser
      .mockResolvedValueOnce({ uid: 'uid-1' })
      .mockResolvedValueOnce({ uid: 'uid-2' });

    const result = await createTenantHandler(makeRequest(input));

    expect(result.message).toContain('2 admin(s)');
    expect(mockAuth.setCustomUserClaims).toHaveBeenCalledTimes(2);
  });
});

// ─── updateTenantHandler Tests ──────────────────────────

describe('updateTenantHandler', () => {
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockTenantGet: ReturnType<typeof vi.fn>;
  let mockSlugGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUpdate = vi.fn().mockResolvedValue(undefined);
    mockTenantGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Old Name',
        slug: 'old-slug',
        artDirection: { defaultBrief: 'old brief', quickGenBrief: '', shopifyGenBrief: '', photoshootBrief: '' },
      }),
    });
    mockSlugGet = vi.fn().mockResolvedValue({ empty: true });

    const mockDb = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: mockTenantGet,
          update: mockUpdate,
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: mockSlugGet,
          }),
        }),
      }),
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
  });

  it('updates tenant with valid input', async () => {
    const result = await updateTenantHandler(
      makeRequest({ tenantId: 'tenant-1', name: 'New Name' }),
    );

    expect(result.success).toBe(true);
    expect(result.tenantId).toBe('tenant-1');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Name', updatedAt: expect.any(String) }),
    );
  });

  it('updates allowed features', async () => {
    await updateTenantHandler(
      makeRequest({
        tenantId: 'tenant-1',
        allowedFeatures: { shopifyIntegration: false, photoshootMode: true, quickGeneration: false },
      }),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedFeatures: { shopifyIntegration: false, photoshootMode: true, quickGeneration: false },
      }),
    );
  });

  it('updates status to suspended', async () => {
    await updateTenantHandler(
      makeRequest({ tenantId: 'tenant-1', status: 'suspended' }),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suspended' }),
    );
  });

  it('checks slug uniqueness when slug changes', async () => {
    await updateTenantHandler(
      makeRequest({ tenantId: 'tenant-1', slug: 'new-slug' }),
    );

    expect(mockSlugGet).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'new-slug' }),
    );
  });

  it('rejects duplicate slug', async () => {
    mockSlugGet.mockResolvedValue({ empty: false });

    await expect(
      updateTenantHandler(makeRequest({ tenantId: 'tenant-1', slug: 'taken-slug' })),
    ).rejects.toThrow('already exists');
  });

  it('skips slug uniqueness check when slug unchanged', async () => {
    mockTenantGet.mockResolvedValue({
      exists: true,
      data: () => ({ slug: 'same-slug', artDirection: {} }),
    });

    await updateTenantHandler(
      makeRequest({ tenantId: 'tenant-1', slug: 'same-slug' }),
    );

    expect(mockSlugGet).not.toHaveBeenCalled();
  });

  it('updates Gemini API key in Secret Manager', async () => {
    await updateTenantHandler(
      makeRequest({ tenantId: 'tenant-1', geminiApiKey: 'new-key-456' }),
    );

    expect(createOrUpdateSecret).toHaveBeenCalledWith(
      'tenant-tenant-1-gemini-api-key',
      'new-key-456',
    );
  });

  it('does not call Secret Manager when no geminiApiKey provided', async () => {
    await updateTenantHandler(
      makeRequest({ tenantId: 'tenant-1', name: 'Updated' }),
    );

    expect(createOrUpdateSecret).not.toHaveBeenCalled();
  });

  it('merges artDirection with existing data', async () => {
    await updateTenantHandler(
      makeRequest({
        tenantId: 'tenant-1',
        artDirection: { quickGenBrief: 'new quick brief' },
      }),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        artDirection: expect.objectContaining({
          defaultBrief: 'old brief',
          quickGenBrief: 'new quick brief',
        }),
      }),
    );
  });

  it('throws when tenant not found', async () => {
    mockTenantGet.mockResolvedValue({ exists: false });

    await expect(
      updateTenantHandler(makeRequest({ tenantId: 'nonexistent', name: 'X' })),
    ).rejects.toThrow('Tenant not found');
  });

  it('rejects missing tenantId', async () => {
    await expect(
      updateTenantHandler(makeRequest({ name: 'No ID' })),
    ).rejects.toThrow();
  });

  it('rejects non-admin users', async () => {
    const request = {
      data: { tenantId: 'tenant-1', name: 'Hack' },
      auth: { uid: 'user-1', token: { role: 'tenant_user', tenantId: 'tenant-1' } },
      rawRequest: {},
    } as unknown as CallableRequest;

    await expect(updateTenantHandler(request)).rejects.toThrow('Forbidden');
  });
});

// ─── listTenantUsersHandler Tests ──────────────────────────

describe('listTenantUsersHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns users for a tenant', async () => {
    const mockDocs = [
      { id: 'uid-1', data: () => ({ email: 'a@test.com', role: 'tenant_admin', createdAt: '2025-01-02' }) },
      { id: 'uid-2', data: () => ({ email: 'b@test.com', role: 'tenant_user', createdAt: '2025-01-01' }) },
    ];

    const mockDb = {
      collection: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: mockDocs }),
        }),
      }),
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const result = await listTenantUsersHandler(makeRequest({ tenantId: 'tenant-1' }));

    expect(result.users).toHaveLength(2);
    expect(result.users[0]).toEqual({ uid: 'uid-1', email: 'a@test.com', role: 'tenant_admin', createdAt: '2025-01-02' });
    expect(result.users[1]).toEqual({ uid: 'uid-2', email: 'b@test.com', role: 'tenant_user', createdAt: '2025-01-01' });
    expect(mockDb.collection).toHaveBeenCalledWith('tenants/tenant-1/users');
  });

  it('returns empty array when no users', async () => {
    const mockDb = {
      collection: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: [] }),
        }),
      }),
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const result = await listTenantUsersHandler(makeRequest({ tenantId: 'tenant-1' }));
    expect(result.users).toEqual([]);
  });

  it('rejects missing tenantId', async () => {
    await expect(
      listTenantUsersHandler(makeRequest({})),
    ).rejects.toThrow('tenantId is required');
  });

  it('rejects non-admin users', async () => {
    const request = {
      data: { tenantId: 'tenant-1' },
      auth: { uid: 'user-1', token: { role: 'tenant_user', tenantId: 'tenant-1' } },
      rawRequest: {},
    } as unknown as CallableRequest;

    await expect(listTenantUsersHandler(request)).rejects.toThrow('Forbidden');
  });
});

// ─── inviteTenantUserHandler Tests ──────────────────────────

describe('inviteTenantUserHandler', () => {
  let mockAuth: ReturnType<typeof createMockAuth>;
  let mockSet: ReturnType<typeof vi.fn>;
  let mockExistingUsersGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth = createMockAuth();
    mockSet = vi.fn().mockResolvedValue(undefined);
    mockExistingUsersGet = vi.fn().mockResolvedValue({ empty: true });

    const mockDb = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true }),
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: mockExistingUsersGet,
          }),
        }),
      }),
      doc: vi.fn().mockReturnValue({ set: mockSet }),
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue(mockAuth);

    mockAuth.getUserByEmail.mockRejectedValue(new Error('User not found'));
    mockAuth.createUser.mockResolvedValue({ uid: 'new-uid' });
  });

  it('invites a new user as tenant_admin by default', async () => {
    const result = await inviteTenantUserHandler(
      makeRequest({ tenantId: 'tenant-1', email: 'new@test.com' }),
    );

    expect(result.success).toBe(true);
    expect(result.uid).toBe('new-uid');
    expect(result.role).toBe('tenant_admin');
    expect(mockAuth.createUser).toHaveBeenCalledWith({ email: 'new@test.com' });
    expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('new-uid', {
      role: 'tenant_admin',
      tenantId: 'tenant-1',
    });
  });

  it('invites a user with tenant_user role', async () => {
    const result = await inviteTenantUserHandler(
      makeRequest({ tenantId: 'tenant-1', email: 'user@test.com', role: 'tenant_user' }),
    );

    expect(result.role).toBe('tenant_user');
    expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('new-uid', {
      role: 'tenant_user',
      tenantId: 'tenant-1',
    });
  });

  it('reuses existing Firebase Auth user', async () => {
    mockAuth.getUserByEmail.mockResolvedValue({ uid: 'existing-uid' });

    const result = await inviteTenantUserHandler(
      makeRequest({ tenantId: 'tenant-1', email: 'existing@test.com' }),
    );

    expect(result.uid).toBe('existing-uid');
    expect(mockAuth.createUser).not.toHaveBeenCalled();
  });

  it('creates user document in tenant subcollection', async () => {
    await inviteTenantUserHandler(
      makeRequest({ tenantId: 'tenant-1', email: 'new@test.com' }),
    );

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@test.com',
        role: 'tenant_admin',
        status: 'active',
        invitedBy: 'admin-uid-1',
      }),
    );
  });

  it('rejects if user already a member', async () => {
    mockExistingUsersGet.mockResolvedValue({ empty: false });

    await expect(
      inviteTenantUserHandler(makeRequest({ tenantId: 'tenant-1', email: 'dup@test.com' })),
    ).rejects.toThrow('already a member');
  });

  it('rejects if tenant not found', async () => {
    const mockDb = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: true }),
          }),
        }),
      }),
      doc: vi.fn().mockReturnValue({ set: mockSet }),
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    await expect(
      inviteTenantUserHandler(makeRequest({ tenantId: 'no-tenant', email: 'a@test.com' })),
    ).rejects.toThrow('Tenant not found');
  });

  it('rejects missing tenantId', async () => {
    await expect(
      inviteTenantUserHandler(makeRequest({ email: 'a@test.com' })),
    ).rejects.toThrow('tenantId is required');
  });

  it('rejects invalid email', async () => {
    await expect(
      inviteTenantUserHandler(makeRequest({ tenantId: 'tenant-1', email: 'not-an-email' })),
    ).rejects.toThrow('Valid email is required');
  });

  it('rejects missing email', async () => {
    await expect(
      inviteTenantUserHandler(makeRequest({ tenantId: 'tenant-1' })),
    ).rejects.toThrow('Valid email is required');
  });

  it('rejects non-admin users', async () => {
    const request = {
      data: { tenantId: 'tenant-1', email: 'a@test.com' },
      auth: { uid: 'user-1', token: { role: 'tenant_user', tenantId: 'tenant-1' } },
      rawRequest: {},
    } as unknown as CallableRequest;

    await expect(inviteTenantUserHandler(request)).rejects.toThrow('Forbidden');
  });
});

// ─── removeTenantUserHandler Tests ──────────────────────────

describe('removeTenantUserHandler', () => {
  let mockAuth: ReturnType<typeof createMockAuth>;
  let mockDelete: ReturnType<typeof vi.fn>;
  let mockUserGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth = createMockAuth();
    mockDelete = vi.fn().mockResolvedValue(undefined);
    mockUserGet = vi.fn().mockResolvedValue({ exists: true });

    const mockDb = {
      doc: vi.fn().mockReturnValue({
        get: mockUserGet,
        delete: mockDelete,
      }),
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue(mockAuth);
  });

  it('removes user and clears claims', async () => {
    const result = await removeTenantUserHandler(
      makeRequest({ tenantId: 'tenant-1', uid: 'user-uid' }),
    );

    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('user-uid', {});
  });

  it('succeeds even if clearing claims fails (user deleted from Auth)', async () => {
    mockAuth.setCustomUserClaims.mockRejectedValue(new Error('User not found'));

    const result = await removeTenantUserHandler(
      makeRequest({ tenantId: 'tenant-1', uid: 'deleted-uid' }),
    );

    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('rejects if user doc not found', async () => {
    mockUserGet.mockResolvedValue({ exists: false });

    await expect(
      removeTenantUserHandler(makeRequest({ tenantId: 'tenant-1', uid: 'ghost' })),
    ).rejects.toThrow('User not found in this tenant');
  });

  it('rejects missing tenantId', async () => {
    await expect(
      removeTenantUserHandler(makeRequest({ uid: 'user-1' })),
    ).rejects.toThrow('tenantId is required');
  });

  it('rejects missing uid', async () => {
    await expect(
      removeTenantUserHandler(makeRequest({ tenantId: 'tenant-1' })),
    ).rejects.toThrow('uid is required');
  });

  it('rejects non-admin users', async () => {
    const request = {
      data: { tenantId: 'tenant-1', uid: 'user-1' },
      auth: { uid: 'user-1', token: { role: 'tenant_user', tenantId: 'tenant-1' } },
      rawRequest: {},
    } as unknown as CallableRequest;

    await expect(removeTenantUserHandler(request)).rejects.toThrow('Forbidden');
  });
});

// ─── deleteTenantHandler Tests ──────────────────────────

describe('deleteTenantHandler', () => {
  let mockAuth: ReturnType<typeof createMockAuth>;
  let mockTenantGet: ReturnType<typeof vi.fn>;
  let mockTenantDelete: ReturnType<typeof vi.fn>;
  let mockUsersGet: ReturnType<typeof vi.fn>;
  let mockUserRefDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth = createMockAuth();
    mockTenantDelete = vi.fn().mockResolvedValue(undefined);
    mockUserRefDelete = vi.fn().mockResolvedValue(undefined);
    mockTenantGet = vi.fn().mockResolvedValue({ exists: true });
    mockUsersGet = vi.fn().mockResolvedValue({ docs: [] });

    const mockDb = {
      collection: vi.fn((path: string) => {
        if (path.includes('/users')) {
          return { get: mockUsersGet };
        }
        return {
          doc: vi.fn().mockReturnValue({
            get: mockTenantGet,
            delete: mockTenantDelete,
          }),
        };
      }),
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue(mockAuth);
  });

  it('deletes a tenant with no users', async () => {
    const result = await deleteTenantHandler(makeRequest({ tenantId: 'tenant-1' }));

    expect(result.success).toBe(true);
    expect(result.tenantId).toBe('tenant-1');
    expect(mockTenantDelete).toHaveBeenCalledTimes(1);
  });

  it('deletes tenant users and clears their claims', async () => {
    mockUsersGet.mockResolvedValue({
      docs: [
        { id: 'uid-1', ref: { delete: mockUserRefDelete } },
        { id: 'uid-2', ref: { delete: mockUserRefDelete } },
      ],
    });

    const result = await deleteTenantHandler(makeRequest({ tenantId: 'tenant-1' }));

    expect(result.success).toBe(true);
    expect(mockAuth.setCustomUserClaims).toHaveBeenCalledTimes(2);
    expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('uid-1', {});
    expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('uid-2', {});
    expect(mockUserRefDelete).toHaveBeenCalledTimes(2);
    expect(mockTenantDelete).toHaveBeenCalledTimes(1);
  });

  it('continues deleting even if clearing claims fails', async () => {
    mockAuth.setCustomUserClaims.mockRejectedValue(new Error('Auth error'));
    mockUsersGet.mockResolvedValue({
      docs: [{ id: 'uid-1', ref: { delete: mockUserRefDelete } }],
    });

    const result = await deleteTenantHandler(makeRequest({ tenantId: 'tenant-1' }));

    expect(result.success).toBe(true);
    expect(mockUserRefDelete).toHaveBeenCalledTimes(1);
    expect(mockTenantDelete).toHaveBeenCalledTimes(1);
  });

  it('rejects if tenant not found', async () => {
    mockTenantGet.mockResolvedValue({ exists: false });

    await expect(
      deleteTenantHandler(makeRequest({ tenantId: 'nonexistent' })),
    ).rejects.toThrow('Tenant not found');
  });

  it('rejects missing tenantId', async () => {
    await expect(
      deleteTenantHandler(makeRequest({})),
    ).rejects.toThrow('tenantId is required');
  });

  it('rejects non-admin users', async () => {
    const request = {
      data: { tenantId: 'tenant-1' },
      auth: { uid: 'user-1', token: { role: 'tenant_user', tenantId: 'tenant-1' } },
      rawRequest: {},
    } as unknown as CallableRequest;

    await expect(deleteTenantHandler(request)).rejects.toThrow('Forbidden');
  });
});
