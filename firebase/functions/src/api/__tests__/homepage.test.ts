import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
}));

import { getHomepageConfigHandler, updateHomepageConfigHandler } from '../homepage';
import { getDb } from '../../services/firebase-admin';
import { makeAdminClaims, makeTenantUserClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;

function makeRequest(
  data: Record<string, unknown> = {},
  claims = makeAdminClaims(),
): CallableRequest {
  return {
    data,
    auth: { uid: 'admin-uid-1', token: claims },
    rawRequest: {},
  } as unknown as CallableRequest;
}

describe('getHomepageConfigHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns default config when no document exists', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    });

    const result = await getHomepageConfigHandler(makeRequest());
    expect(result.hero.title).toBe('Welcome to Vizo');
    expect(result.whatsNew).toEqual([]);
    expect(result.trending).toEqual([]);
  });

  it('returns stored config', async () => {
    const storedConfig = {
      hero: { imageUrl: '/hero.jpg', title: 'Custom', subtitle: 'Sub', ctaText: 'Go', ctaLink: '/' },
      whatsNew: [{ imageUrl: '/new.jpg', title: 'New Feature', description: 'Desc', link: '/', order: 0 }],
      trending: [],
      updatedAt: '2025-01-01T00:00:00Z',
      updatedBy: 'admin-1',
    };

    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => storedConfig }),
      }),
    });

    const result = await getHomepageConfigHandler(makeRequest());
    expect(result.hero.title).toBe('Custom');
    expect(result.whatsNew).toHaveLength(1);
  });
});

describe('updateHomepageConfigHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires admin role', async () => {
    await expect(
      updateHomepageConfigHandler(
        makeRequest({}, makeTenantUserClaims()),
      ),
    ).rejects.toThrow('Forbidden');
  });

  it('validates input schema', async () => {
    await expect(
      updateHomepageConfigHandler(makeRequest({ hero: 'invalid' })),
    ).rejects.toThrow();
  });

  it('saves valid config', async () => {
    const setFn = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({ set: setFn }),
    });

    const result = await updateHomepageConfigHandler(makeRequest({
      hero: { imageUrl: '/hero.jpg', title: 'Title', subtitle: 'Sub', ctaText: 'CTA', ctaLink: '/link' },
      whatsNew: [],
      trending: [],
    }));

    expect(result.success).toBe(true);
    expect(setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        hero: expect.objectContaining({ title: 'Title' }),
        updatedBy: 'admin-uid-1',
      }),
    );
  });
});
