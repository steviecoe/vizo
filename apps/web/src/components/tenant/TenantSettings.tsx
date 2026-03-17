'use client';

import { useReducer, useEffect } from 'react';
import { callFunction } from '@/lib/firebase/functions';
import type { SupportedLocale } from '@vizo/shared';
import { SUPPORTED_LOCALES, LOCALE_LABELS } from '@vizo/shared';

// ─── Types ────────────────────────────────────────────────

type PageStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

interface SettingsState {
  status: PageStatus;
  defaultLocale: SupportedLocale;
  autoDetect: boolean;
  serverError: string | null;
}

type SettingsAction =
  | { type: 'SET_LOADED'; defaultLocale: SupportedLocale; autoDetect: boolean }
  | { type: 'SET_FIELD'; field: 'defaultLocale'; value: SupportedLocale }
  | { type: 'SET_AUTO_DETECT'; value: boolean }
  | { type: 'SET_SAVING' }
  | { type: 'SET_SAVED' }
  | { type: 'SET_ERROR'; error: string };

const initialState: SettingsState = {
  status: 'loading',
  defaultLocale: 'en',
  autoDetect: true,
  serverError: null,
};

function reducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'SET_LOADED':
      return { ...state, status: 'idle', defaultLocale: action.defaultLocale, autoDetect: action.autoDetect };
    case 'SET_FIELD':
      return { ...state, status: 'idle', defaultLocale: action.value, serverError: null };
    case 'SET_AUTO_DETECT':
      return { ...state, status: 'idle', autoDetect: action.value, serverError: null };
    case 'SET_SAVING':
      return { ...state, status: 'saving', serverError: null };
    case 'SET_SAVED':
      return { ...state, status: 'saved', serverError: null };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────

export function TenantSettings() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, defaultLocale, autoDetect, serverError } = state;

  useEffect(() => {
    async function load() {
      try {
        const result = await callFunction<{
          language: { defaultLocale: SupportedLocale; autoDetect: boolean };
        }>('getTenantSettings');
        dispatch({
          type: 'SET_LOADED',
          defaultLocale: result.language.defaultLocale,
          autoDetect: result.language.autoDetect,
        });
      } catch (err: unknown) {
        const error = err as { message?: string };
        dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to load settings' });
      }
    }
    load();
  }, []);

  async function handleSave() {
    dispatch({ type: 'SET_SAVING' });
    try {
      await callFunction('updateTenantLanguage', { defaultLocale, autoDetect });
      dispatch({ type: 'SET_SAVED' });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to save settings' });
    }
  }

  if (status === 'loading') {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Manage your account and language preferences.
        </p>
      </div>

      {/* Language Settings */}
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-6">
        <h2 className="text-lg font-semibold font-display text-stone-900">Language</h2>
        <p className="mt-1 text-sm text-stone-500">
          Configure the interface language for your team. Art direction and GenAI prompts remain in English.
        </p>

        <div className="mt-6 space-y-4">
          {/* Auto-detect toggle */}
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={autoDetect}
              onChange={(e) => dispatch({ type: 'SET_AUTO_DETECT', value: e.target.checked })}
              className="h-4 w-4 rounded border-stone-300 text-stone-950 focus:ring-stone-950"
            />
            <span className="text-sm text-stone-700">
              Auto-detect language based on location (GeoIP)
            </span>
          </label>

          {/* Default locale select */}
          <div>
            <label htmlFor="defaultLocale" className="block text-sm font-medium text-stone-700">
              Default Language
            </label>
            <select
              id="defaultLocale"
              value={defaultLocale}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'defaultLocale', value: e.target.value as SupportedLocale })
              }
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-950 focus:outline-none focus:ring-1 focus:ring-stone-950"
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc} value={loc}>
                  {LOCALE_LABELS[loc]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-400">
              This overrides auto-detection when set explicitly.
            </p>
          </div>
        </div>

        {serverError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {serverError}
          </div>
        )}

        {status === 'saved' && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700" role="status">
            Settings saved successfully.
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={status === 'saving'}
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800 disabled:opacity-50"
          >
            {status === 'saving' ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
