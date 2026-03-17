import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
}));

import {
  createArticleHandler,
  listArticlesAdminHandler,
  listPublishedArticlesHandler,
  deleteArticleHandler,
  getArticleHandler,
} from '../cms';
import { getDb } from '../../services/firebase-admin';
import { makeAdminClaims, makeTenantUserClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;

function makeAdminRequest(data: Record<string, unknown> = {}): CallableRequest {
  return {
    data,
    auth: { uid: 'admin-uid-1', token: makeAdminClaims() },
    rawRequest: {},
  } as unknown as CallableRequest;
}

function makeTenantRequest(data: Record<string, unknown> = {}): CallableRequest {
  return {
    data,
    auth: { uid: 'user-uid-1', token: makeTenantUserClaims() },
    rawRequest: {},
  } as unknown as CallableRequest;
}

const validArticleData = {
  title: 'Getting Started with Vizo',
  slug: 'getting-started',
  body: 'Welcome to the platform. This guide covers the basics.',
  category: 'tutorial',
  status: 'draft',
  coverImageUrl: null,
  tags: ['onboarding'],
};

// ─── createArticleHandler ─────────────────────────────────

describe('createArticleHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates article and returns it with id', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          id: 'article-1',
          set: mockSet,
        }),
      }),
    });

    const result = await createArticleHandler(makeAdminRequest(validArticleData));

    expect(result.id).toBe('article-1');
    expect(result.title).toBe('Getting Started with Vizo');
    expect(result.slug).toBe('getting-started');
    expect(result.createdBy).toBe('admin-uid-1');
    expect(result.publishedAt).toBeNull(); // draft -> no publishedAt
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it('sets publishedAt when status is published', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          id: 'article-2',
          set: mockSet,
        }),
      }),
    });

    const result = await createArticleHandler(
      makeAdminRequest({ ...validArticleData, status: 'published' }),
    );

    expect(result.publishedAt).not.toBeNull();
  });

  it('rejects invalid article data', async () => {
    await expect(
      createArticleHandler(makeAdminRequest({ title: '' })),
    ).rejects.toThrow();
  });

  it('rejects non-admin users', async () => {
    await expect(
      createArticleHandler(makeTenantRequest(validArticleData)),
    ).rejects.toThrow('Forbidden');
  });
});

// ─── listArticlesAdminHandler ─────────────────────────────

describe('listArticlesAdminHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all articles ordered by createdAt desc', async () => {
    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: [
              { id: 'article-1', data: () => ({ title: 'First', status: 'published' }) },
              { id: 'article-2', data: () => ({ title: 'Second', status: 'draft' }) },
            ],
          }),
        }),
      }),
    });

    const result = await listArticlesAdminHandler(makeAdminRequest());

    expect(result.articles).toHaveLength(2);
    expect(result.articles[0].id).toBe('article-1');
    expect(result.articles[1].id).toBe('article-2');
  });
});

// ─── listPublishedArticlesHandler ─────────────────────────

describe('listPublishedArticlesHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only published articles sorted by publishedAt desc', async () => {
    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: [
              { id: 'article-1', data: () => ({ title: 'Older', status: 'published', publishedAt: '2025-01-01T00:00:00Z' }) },
              { id: 'article-2', data: () => ({ title: 'Newer', status: 'published', publishedAt: '2025-02-01T00:00:00Z' }) },
            ],
          }),
        }),
      }),
    });

    const result = await listPublishedArticlesHandler(makeTenantRequest({}));

    expect(result.articles).toHaveLength(2);
    expect(result.articles[0].title).toBe('Newer');
    expect(result.articles[1].title).toBe('Older');
  });

  it('filters by category when provided', async () => {
    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: [
              { id: 'article-1', data: () => ({ title: 'Tutorial', category: 'tutorial', publishedAt: '2025-01-01T00:00:00Z' }) },
              { id: 'article-2', data: () => ({ title: 'News Item', category: 'news', publishedAt: '2025-02-01T00:00:00Z' }) },
            ],
          }),
        }),
      }),
    });

    const result = await listPublishedArticlesHandler(
      makeTenantRequest({ category: 'tutorial' }),
    );

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].category).toBe('tutorial');
  });
});

// ─── deleteArticleHandler ─────────────────────────────────

describe('deleteArticleHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes existing article', async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true }),
        delete: mockDelete,
      }),
    });

    const result = await deleteArticleHandler(
      makeAdminRequest({ articleId: 'article-1' }),
    );

    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('throws when article not found', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    });

    await expect(
      deleteArticleHandler(makeAdminRequest({ articleId: 'nonexistent' })),
    ).rejects.toThrow('Article not found');
  });

  it('rejects missing articleId', async () => {
    await expect(
      deleteArticleHandler(makeAdminRequest({})),
    ).rejects.toThrow('articleId is required');
  });
});

// ─── getArticleHandler ────────────────────────────────────

describe('getArticleHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns published article', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          id: 'article-1',
          data: () => ({
            title: 'Published Article',
            status: 'published',
            body: 'Content here',
          }),
        }),
      }),
    });

    const result = await getArticleHandler(
      makeTenantRequest({ articleId: 'article-1' }),
    );

    expect(result.id).toBe('article-1');
    expect(result.title).toBe('Published Article');
  });

  it('rejects non-published article (returns not found)', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          id: 'article-1',
          data: () => ({ title: 'Draft Article', status: 'draft' }),
        }),
      }),
    });

    await expect(
      getArticleHandler(makeTenantRequest({ articleId: 'article-1' })),
    ).rejects.toThrow('Article not found');
  });

  it('throws when article does not exist', async () => {
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    });

    await expect(
      getArticleHandler(makeTenantRequest({ articleId: 'nonexistent' })),
    ).rejects.toThrow('Article not found');
  });
});
