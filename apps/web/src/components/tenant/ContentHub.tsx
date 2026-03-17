'use client';

import { useReducer, useEffect } from 'react';
import { callFunction } from '@/lib/firebase/functions';
import type { CmsArticle, CmsArticleCategory } from '@vizo/shared';

// ─── Types ────────────────────────────────────────────────

type PageStatus = 'loading' | 'idle' | 'reading' | 'error';

interface ContentState {
  status: PageStatus;
  articles: CmsArticle[];
  selectedArticle: CmsArticle | null;
  activeCategory: CmsArticleCategory | 'all';
  serverError: string | null;
}

type ContentAction =
  | { type: 'SET_LOADED'; articles: CmsArticle[] }
  | { type: 'SET_CATEGORY'; category: CmsArticleCategory | 'all' }
  | { type: 'SET_READING'; article: CmsArticle }
  | { type: 'BACK_TO_LIST' }
  | { type: 'SET_ERROR'; error: string };

const initialState: ContentState = {
  status: 'loading',
  articles: [],
  selectedArticle: null,
  activeCategory: 'all',
  serverError: null,
};

function reducer(state: ContentState, action: ContentAction): ContentState {
  switch (action.type) {
    case 'SET_LOADED':
      return { ...state, status: 'idle', articles: action.articles, serverError: null };
    case 'SET_CATEGORY':
      return { ...state, activeCategory: action.category };
    case 'SET_READING':
      return { ...state, status: 'reading', selectedArticle: action.article };
    case 'BACK_TO_LIST':
      return { ...state, status: 'idle', selectedArticle: null };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    default:
      return state;
  }
}

const CATEGORIES: Array<{ value: CmsArticleCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'tutorial', label: 'Tutorials' },
  { value: 'guide', label: 'Guides' },
  { value: 'news', label: 'News' },
  { value: 'update', label: 'Updates' },
  { value: 'faq', label: 'FAQ' },
];

// ─── Component ────────────────────────────────────────────

export function ContentHub() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, articles, selectedArticle, activeCategory, serverError } = state;

  useEffect(() => {
    async function load() {
      try {
        const result = await callFunction<{ articles: CmsArticle[] }>('listPublishedArticles', {});
        dispatch({ type: 'SET_LOADED', articles: result.articles });
      } catch (err: unknown) {
        const error = err as { message?: string };
        dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to load content' });
      }
    }
    load();
  }, []);

  const filteredArticles = activeCategory === 'all'
    ? articles
    : articles.filter((a) => a.category === activeCategory);

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-stone-200" />
          ))}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-6" role="alert">
        <h2 className="font-semibold font-display text-red-800">Content unavailable</h2>
        <p className="mt-1 text-sm text-red-700">{serverError}</p>
      </div>
    );
  }

  // ─── Article Reader ─────────────────────────────────────
  if (status === 'reading' && selectedArticle) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => dispatch({ type: 'BACK_TO_LIST' })}
          className="text-sm text-stone-950 hover:text-stone-950"
        >
          &larr; Back to articles
        </button>

        <article className="rounded-lg border border-stone-200 bg-stone-50 p-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-stone-950">
              {selectedArticle.category}
            </span>
            {selectedArticle.tags.map((tag) => (
              <span key={tag} className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-950">
                {tag}
              </span>
            ))}
          </div>

          <h1 className="text-3xl font-bold font-display text-stone-900">{selectedArticle.title}</h1>

          {selectedArticle.publishedAt && (
            <p className="mt-2 text-sm text-stone-500">
              Published {new Date(selectedArticle.publishedAt).toLocaleDateString()}
            </p>
          )}

          <div className="prose mt-6 max-w-none text-stone-700">
            {selectedArticle.body.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </article>
      </div>
    );
  }

  // ─── Article List ───────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-900">Help & Resources</h1>
        <p className="mt-1 text-sm text-stone-500">
          Tutorials, guides, and platform updates.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-stone-200 pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => dispatch({ type: 'SET_CATEGORY', category: cat.value })}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat.value
                ? 'bg-stone-950 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filteredArticles.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-8 text-center">
          <p className="text-stone-500">No articles available in this category.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map((article) => (
            <button
              key={article.id}
              onClick={() => dispatch({ type: 'SET_READING', article })}
              className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-left transition-shadow hover:shadow-md"
            >
              <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-stone-950">
                {article.category}
              </span>
              <h3 className="mt-3 text-lg font-semibold font-display text-stone-900">{article.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-stone-500">
                {article.body.slice(0, 150)}
                {article.body.length > 150 ? '...' : ''}
              </p>
              {article.publishedAt && (
                <p className="mt-3 text-xs text-stone-400">
                  {new Date(article.publishedAt).toLocaleDateString()}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
