'use client';

import { useReducer, useEffect } from 'react';
import { callFunction } from '@/lib/firebase/functions';
import type { CmsArticle, CmsArticleCategory, CmsArticleStatus } from '@vizo/shared';

// ─── Types ────────────────────────────────────────────────

type PageStatus = 'loading' | 'idle' | 'creating' | 'editing' | 'saving' | 'error';

interface CmsState {
  status: PageStatus;
  articles: CmsArticle[];
  editingArticle: Partial<CmsArticle> | null;
  serverError: string | null;
}

type CmsAction =
  | { type: 'SET_LOADED'; articles: CmsArticle[] }
  | { type: 'SET_CREATING' }
  | { type: 'SET_EDITING'; article: CmsArticle }
  | { type: 'UPDATE_FIELD'; field: string; value: unknown }
  | { type: 'SET_SAVING' }
  | { type: 'SET_SAVED'; article: CmsArticle }
  | { type: 'SET_DELETED'; articleId: string }
  | { type: 'CANCEL_EDIT' }
  | { type: 'SET_ERROR'; error: string };

const emptyArticle: Partial<CmsArticle> = {
  title: '',
  slug: '',
  body: '',
  category: 'news',
  status: 'draft',
  coverImageUrl: null,
  tags: [],
};

const initialState: CmsState = {
  status: 'loading',
  articles: [],
  editingArticle: null,
  serverError: null,
};

function reducer(state: CmsState, action: CmsAction): CmsState {
  switch (action.type) {
    case 'SET_LOADED':
      return { ...state, status: 'idle', articles: action.articles, serverError: null };
    case 'SET_CREATING':
      return { ...state, status: 'creating', editingArticle: { ...emptyArticle }, serverError: null };
    case 'SET_EDITING':
      return { ...state, status: 'editing', editingArticle: { ...action.article }, serverError: null };
    case 'UPDATE_FIELD':
      return {
        ...state,
        editingArticle: state.editingArticle
          ? { ...state.editingArticle, [action.field]: action.value }
          : null,
      };
    case 'SET_SAVING':
      return { ...state, status: 'saving', serverError: null };
    case 'SET_SAVED': {
      const existing = state.articles.findIndex((a) => a.id === action.article.id);
      const articles = existing >= 0
        ? state.articles.map((a) => (a.id === action.article.id ? action.article : a))
        : [action.article, ...state.articles];
      return { ...state, status: 'idle', articles, editingArticle: null, serverError: null };
    }
    case 'SET_DELETED':
      return {
        ...state,
        status: 'idle',
        articles: state.articles.filter((a) => a.id !== action.articleId),
        serverError: null,
      };
    case 'CANCEL_EDIT':
      return { ...state, status: 'idle', editingArticle: null, serverError: null };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    default:
      return state;
  }
}

// ─── Constants ────────────────────────────────────────────

const CATEGORIES: CmsArticleCategory[] = ['tutorial', 'news', 'update', 'guide', 'faq'];
const STATUSES: CmsArticleStatus[] = ['draft', 'published', 'archived'];

// ─── Component ────────────────────────────────────────────

export function CmsManager() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, articles, editingArticle, serverError } = state;

  useEffect(() => {
    async function load() {
      try {
        const result = await callFunction<{ articles: CmsArticle[] }>('listArticlesAdmin');
        dispatch({ type: 'SET_LOADED', articles: result.articles });
      } catch (err: unknown) {
        const error = err as { message?: string };
        dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to load articles' });
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!editingArticle) return;
    dispatch({ type: 'SET_SAVING' });

    try {
      if (editingArticle.id) {
        const result = await callFunction<CmsArticle>('updateArticle', {
          articleId: editingArticle.id,
          title: editingArticle.title,
          slug: editingArticle.slug,
          body: editingArticle.body,
          category: editingArticle.category,
          status: editingArticle.status,
          coverImageUrl: editingArticle.coverImageUrl || null,
          tags: editingArticle.tags || [],
        });
        dispatch({ type: 'SET_SAVED', article: result });
      } else {
        const result = await callFunction<CmsArticle>('createArticle', {
          title: editingArticle.title,
          slug: editingArticle.slug,
          body: editingArticle.body,
          category: editingArticle.category,
          status: editingArticle.status,
          coverImageUrl: editingArticle.coverImageUrl || null,
          tags: editingArticle.tags || [],
        });
        dispatch({ type: 'SET_SAVED', article: result });
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to save article' });
    }
  }

  async function handleDelete(articleId: string) {
    try {
      await callFunction('deleteArticle', { articleId });
      dispatch({ type: 'SET_DELETED', articleId });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to delete article' });
    }
  }

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
      </div>
    );
  }

  // ─── Editor View ────────────────────────────────────────
  if (editingArticle) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display text-stone-900">
            {editingArticle.id ? 'Edit Article' : 'New Article'}
          </h1>
          <button
            onClick={() => dispatch({ type: 'CANCEL_EDIT' })}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-stone-700">Title</label>
            <input
              id="title"
              type="text"
              value={editingArticle.title || ''}
              onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'title', value: e.target.value })}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-stone-700">Slug</label>
            <input
              id="slug"
              type="text"
              value={editingArticle.slug || ''}
              onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'slug', value: e.target.value })}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              placeholder="my-article-slug"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-stone-700">Category</label>
              <select
                id="category"
                value={editingArticle.category || 'news'}
                onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'category', value: e.target.value })}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-stone-700">Status</label>
              <select
                id="status"
                value={editingArticle.status || 'draft'}
                onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'status', value: e.target.value })}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="body" className="block text-sm font-medium text-stone-700">Body</label>
            <textarea
              id="body"
              rows={12}
              value={editingArticle.body || ''}
              onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'body', value: e.target.value })}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              placeholder="Article content (supports markdown)"
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-stone-700">Tags (comma-separated)</label>
            <input
              id="tags"
              type="text"
              value={(editingArticle.tags || []).join(', ')}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_FIELD',
                  field: 'tags',
                  value: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                })
              }
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          {serverError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {serverError}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={status === 'saving'}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {status === 'saving' ? 'Saving...' : 'Save Article'}
          </button>
        </div>
      </div>
    );
  }

  // ─── List View ──────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-900">Content Management</h1>
          <p className="mt-1 text-sm text-stone-500">Create and manage articles, tutorials, and news.</p>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_CREATING' })}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          New Article
        </button>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {serverError}
        </div>
      )}

      {articles.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-8 text-center">
          <p className="text-stone-500">No articles yet. Create your first article.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {articles.map((article) => (
                <tr key={article.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-stone-900">{article.title}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-stone-500">
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-stone-950">
                      {article.category}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-stone-500">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        article.status === 'published'
                          ? 'bg-green-100 text-stone-950'
                          : article.status === 'draft'
                            ? 'bg-yellow-100 text-stone-950'
                            : 'bg-stone-100 text-stone-950'
                      }`}
                    >
                      {article.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => dispatch({ type: 'SET_EDITING', article })}
                      className="mr-3 text-brand-600 hover:text-brand-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(article.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
