import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
}));

import { getTenantSettingsHandler, updateTenantLanguageHandler } from '../tenant-settings';
import { getDb } from '../../services/firebase-admin';
import {
  makeTenantUserClaims,
  makeTenantAdminClaims,
} from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;

function makeRequest(
  data: Record<string, unknown> = {},
  claims = makeTenantUserClaims(),
): CallableRequest {
  return {
    data,
    auth: { uid: 'user-uid-1', token: claims },
    rawRequest: {},
  } as unknown as CallableRequest;
}

// ─── getTenantSettingsHandler ─────────────────────────────

describe('getTenantSettingsHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns language settings for tenant', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            language: { defaultLocale: 'pl', autoDetect: false },
          }),
        }),
      }),
    });

    const result = await getTenantSettingsHandler(makeRequest());

    expect(result.language).toEqual({
      defaultLocale: 'pl',
      autoDetect: false,
    });
  });

  it('returns default language when tenant has none set', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({}),
        }),
      }),
    });

    const result = await getTenantSettingsHandler(makeRequest());

    expect(result.language).toEqual({
      defaultLocale: 'en',
      autoDetect: true,
    });
  });

  it('throws when tenant not found', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    });

    await expect(getTenantSettingsHandler(makeRequest())).rejects.toThrow(
      'Tenant not found',
    );
  });
});

// ─── updateTenantLanguageHandler ──────────────────────────

describe('updateTenantLanguageHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates locale for tenant admin', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            language: { defaultLocale: 'en', autoDetect: true },
          }),
        }),
        update: mockUpdate,
      }),
    });

    const result = await updateTenantLanguageHandler(
      makeRequest(
        { defaultLocale: 'de', autoDetect: false },
        makeTenantAdminClaims(),
      ),
    );

    expect(result.success).toBe(true);
    expect(result.language).toEqual({
      defaultLocale: 'de',
      autoDetect: false,
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        language: { defaultLocale: 'de', autoDetect: false },
      }),
    );
  });

  it('rejects unsupported locale', async () => {
    await expect(
      updateTenantLanguageHandler(
        makeRequest(
          { defaultLocale: 'xx' },
          makeTenantAdminClaims(),
        ),
      ),
    ).rejects.toThrow('Unsupported locale');
  });

  it('rejects tenant_user (requires tenant_admin)', async () => {
    await expect(
      updateTenantLanguageHandler(
        makeRequest(
          { defaultLocale: 'fr' },
          makeTenantUserClaims(),
        ),
      ),
    ).rejects.toThrow('Forbidden');
  });
});
