'use client';

import { useReducer, useEffect } from 'react';
import type { HomepageConfig, ContentCard, TrendingCard, HeroSection } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────

type EditorTab = 'hero' | 'whatsNew' | 'trending';

interface EditorState {
  loading: boolean;
  saving: boolean;
  tab: EditorTab;
  hero: HeroSection;
  whatsNew: ContentCard[];
  trending: TrendingCard[];
  saveSuccess: boolean;
  error: string | null;
}

type EditorAction =
  | { type: 'LOADED'; config: HomepageConfig }
  | { type: 'SET_TAB'; tab: EditorTab }
  | { type: 'SET_HERO'; field: keyof HeroSection; value: string }
  | { type: 'ADD_WHATS_NEW' }
  | { type: 'UPDATE_WHATS_NEW'; index: number; field: keyof ContentCard; value: string | number }
  | { type: 'REMOVE_WHATS_NEW'; index: number }
  | { type: 'ADD_TRENDING' }
  | { type: 'UPDATE_TRENDING'; index: number; field: keyof TrendingCard; value: string | number | undefined }
  | { type: 'REMOVE_TRENDING'; index: number }
  | { type: 'SAVING' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SET_ERROR'; error: string };

const defaultHero: HeroSection = {
  imageUrl: '',
  title: 'Welcome to Vizo',
  subtitle: 'AI-powered fashion photography',
  ctaText: 'Get Started',
  ctaLink: '/login',
};

const initialState: EditorState = {
  loading: true,
  saving: false,
  tab: 'hero',
  hero: { ...defaultHero },
  whatsNew: [],
  trending: [],
  saveSuccess: false,
  error: null,
};

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'LOADED':
      return {
        ...state,
        loading: false,
        hero: action.config.hero || { ...defaultHero },
        whatsNew: action.config.whatsNew || [],
        trending: action.config.trending || [],
      };
    case 'SET_TAB':
      return { ...state, tab: action.tab, saveSuccess: false };
    case 'SET_HERO':
      return { ...state, hero: { ...state.hero, [action.field]: action.value }, saveSuccess: false };
    case 'ADD_WHATS_NEW':
      return {
        ...state,
        whatsNew: [...state.whatsNew, { imageUrl: '', title: '', description: '', link: '', order: state.whatsNew.length }],
        saveSuccess: false,
      };
    case 'UPDATE_WHATS_NEW': {
      const items = [...state.whatsNew];
      items[action.index] = { ...items[action.index], [action.field]: action.value };
      return { ...state, whatsNew: items, saveSuccess: false };
    }
    case 'REMOVE_WHATS_NEW':
      return { ...state, whatsNew: state.whatsNew.filter((_, i) => i !== action.index), saveSuccess: false };
    case 'ADD_TRENDING':
      return {
        ...state,
        trending: [...state.trending, { imageUrl: '', title: '', order: state.trending.length }],
        saveSuccess: false,
      };
    case 'UPDATE_TRENDING': {
      const items = [...state.trending];
      items[action.index] = { ...items[action.index], [action.field]: action.value };
      return { ...state, trending: items, saveSuccess: false };
    }
    case 'REMOVE_TRENDING':
      return { ...state, trending: state.trending.filter((_, i) => i !== action.index), saveSuccess: false };
    case 'SAVING':
      return { ...state, saving: true, saveSuccess: false, error: null };
    case 'SAVE_SUCCESS':
      return { ...state, saving: false, saveSuccess: true };
    case 'SET_ERROR':
      return { ...state, saving: false, loading: false, error: action.error };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────

export function HomepageEditor() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    async function load() {
      try {
        const config = await callFunction<HomepageConfig>('getHomepageConfig');
        dispatch({ type: 'LOADED', config });
      } catch (err: unknown) {
        dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Failed to load' });
      }
    }
    load();
  }, []);

  async function handleSave() {
    dispatch({ type: 'SAVING' });
    try {
      await callFunction('updateHomepageConfig', {
        hero: state.hero,
        whatsNew: state.whatsNew,
        trending: state.trending,
      });
      dispatch({ type: 'SAVE_SUCCESS' });
    } catch (err: unknown) {
      dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Save failed' });
    }
  }

  if (state.loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
      </div>
    );
  }

  const TABS: { key: EditorTab; label: string }[] = [
    { key: 'hero', label: 'Hero' },
    { key: 'whatsNew', label: "What's New" },
    { key: 'trending', label: 'Trending' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-900">Homepage Editor</h1>
          <p className="mt-1 text-sm text-stone-500">Manage the public homepage content.</p>
        </div>
        <button onClick={handleSave} disabled={state.saving} className="rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {state.saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {state.saveSuccess && (
        <div role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-700">Changes saved successfully.</div>
      )}

      {state.error && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
      )}

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => dispatch({ type: 'SET_TAB', tab: t.key })}
            className={`px-4 py-2 text-sm font-medium ${state.tab === t.key ? 'border-b-2 border-brand-600 text-brand-700' : 'text-stone-500 hover:text-stone-700'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Hero Tab */}
      {state.tab === 'hero' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="hero-title" className="block text-sm font-medium text-stone-700">Title</label>
            <input id="hero-title" type="text" value={state.hero.title} onChange={(e) => dispatch({ type: 'SET_HERO', field: 'title', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="hero-subtitle" className="block text-sm font-medium text-stone-700">Subtitle</label>
            <input id="hero-subtitle" type="text" value={state.hero.subtitle} onChange={(e) => dispatch({ type: 'SET_HERO', field: 'subtitle', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="hero-image" className="block text-sm font-medium text-stone-700">Image URL</label>
            <input id="hero-image" type="text" value={state.hero.imageUrl} onChange={(e) => dispatch({ type: 'SET_HERO', field: 'imageUrl', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="hero-cta-text" className="block text-sm font-medium text-stone-700">CTA Text</label>
              <input id="hero-cta-text" type="text" value={state.hero.ctaText} onChange={(e) => dispatch({ type: 'SET_HERO', field: 'ctaText', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="hero-cta-link" className="block text-sm font-medium text-stone-700">CTA Link</label>
              <input id="hero-cta-link" type="text" value={state.hero.ctaLink} onChange={(e) => dispatch({ type: 'SET_HERO', field: 'ctaLink', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* What's New Tab */}
      {state.tab === 'whatsNew' && (
        <div className="space-y-4">
          {state.whatsNew.map((card, i) => (
            <div key={i} className="rounded-lg border border-stone-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Card {i + 1}</span>
                <button onClick={() => dispatch({ type: 'REMOVE_WHATS_NEW', index: i })} className="text-sm text-red-600 hover:text-red-800">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-500">Title</label>
                  <input type="text" value={card.title} onChange={(e) => dispatch({ type: 'UPDATE_WHATS_NEW', index: i, field: 'title', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500">Image URL</label>
                  <input type="text" value={card.imageUrl} onChange={(e) => dispatch({ type: 'UPDATE_WHATS_NEW', index: i, field: 'imageUrl', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone-500">Description</label>
                <textarea rows={2} value={card.description} onChange={(e) => dispatch({ type: 'UPDATE_WHATS_NEW', index: i, field: 'description', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-stone-500">Link</label>
                <input type="text" value={card.link} onChange={(e) => dispatch({ type: 'UPDATE_WHATS_NEW', index: i, field: 'link', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
              </div>
            </div>
          ))}
          <button onClick={() => dispatch({ type: 'ADD_WHATS_NEW' })} className="rounded-md border border-dashed border-stone-300 px-4 py-2 text-sm text-stone-600 hover:border-stone-400 hover:text-stone-700">
            + Add Card
          </button>
        </div>
      )}

      {/* Trending Tab */}
      {state.tab === 'trending' && (
        <div className="space-y-4">
          {state.trending.map((card, i) => (
            <div key={i} className="rounded-lg border border-stone-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Trending {i + 1}</span>
                <button onClick={() => dispatch({ type: 'REMOVE_TRENDING', index: i })} className="text-sm text-red-600 hover:text-red-800">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-500">Title</label>
                  <input type="text" value={card.title} onChange={(e) => dispatch({ type: 'UPDATE_TRENDING', index: i, field: 'title', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500">Image URL</label>
                  <input type="text" value={card.imageUrl} onChange={(e) => dispatch({ type: 'UPDATE_TRENDING', index: i, field: 'imageUrl', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => dispatch({ type: 'ADD_TRENDING' })} className="rounded-md border border-dashed border-stone-300 px-4 py-2 text-sm text-stone-600 hover:border-stone-400 hover:text-stone-700">
            + Add Trending
          </button>
        </div>
      )}
    </div>
  );
}
