'use client';

import { useReducer, useEffect } from 'react';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────

type PageStatus = 'loading' | 'idle' | 'no_url' | 'error';

interface SupportState {
  status: PageStatus;
  zendeskUrl: string | null;
  serverError: string | null;
}

type SupportAction =
  | { type: 'SET_LOADED'; zendeskUrl: string }
  | { type: 'SET_NO_URL' }
  | { type: 'SET_ERROR'; error: string };

const initialState: SupportState = {
  status: 'loading',
  zendeskUrl: null,
  serverError: null,
};

function reducer(state: SupportState, action: SupportAction): SupportState {
  switch (action.type) {
    case 'SET_LOADED':
      return { status: 'idle', zendeskUrl: action.zendeskUrl, serverError: null };
    case 'SET_NO_URL':
      return { status: 'no_url', zendeskUrl: null, serverError: null };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────

export function SupportEmbed() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, zendeskUrl, serverError } = state;

  useEffect(() => {
    async function load() {
      try {
        const config = await callFunction<{ zendeskUrl?: string }>('getPlatformPublicConfig');
        const url = config.zendeskUrl;
        if (url && url.length > 0) {
          dispatch({ type: 'SET_LOADED', zendeskUrl: url });
        } else {
          dispatch({ type: 'SET_NO_URL' });
        }
      } catch (err: unknown) {
        const error = err as { message?: string };
        dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to load support config' });
      }
    }
    load();
  }, []);

  if (status === 'loading') {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="h-96 animate-pulse rounded-lg bg-stone-200" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-6" role="alert">
        <h2 className="font-semibold font-display text-red-800">Support unavailable</h2>
        <p className="mt-1 text-sm text-red-700">{serverError}</p>
      </div>
    );
  }

  if (status === 'no_url') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-900">Support</h1>
          <p className="mt-1 text-sm text-stone-500">Get help from our support team.</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-8 text-center">
          <p className="text-stone-500">Support is not yet configured.</p>
          <p className="mt-2 text-xs text-stone-400">
            This feature requires a Zendesk URL to be set in Platform Config (<code className="rounded bg-stone-100 px-1">NEXT_PUBLIC_ZENDESK_URL</code> or via Admin &rarr; Homepage Editor). Contact your platform administrator to configure it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-900">Support</h1>
        <p className="mt-1 text-sm text-stone-500">
          Get help from our support team via Zendesk.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200">
        <iframe
          src={zendeskUrl!}
          title="Zendesk Support"
          className="h-[700px] w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          loading="lazy"
        />
      </div>
    </div>
  );
}
