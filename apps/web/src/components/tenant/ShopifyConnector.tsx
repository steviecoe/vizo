'use client';

import { useReducer, useEffect } from 'react';
import { shopifyConnectSchema } from '@vizo/shared';
import type { TenantShopifyConfig } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────

type PageStatus =
  | 'loading'
  | 'disconnected'
  | 'connected'
  | 'connecting'
  | 'syncing'
  | 'disconnecting'
  | 'error';

interface ConnectorState {
  status: PageStatus;
  storeDomain: string;
  adminApiKey: string;
  fieldErrors: Record<string, string[] | undefined>;
  serverError: string | null;
  shopifyConfig: TenantShopifyConfig | null;
  syncResult: { synced: number; archived: number } | null;
}

type ConnectorAction =
  | { type: 'SET_FIELD'; field: 'storeDomain' | 'adminApiKey'; value: string }
  | { type: 'SET_STATUS'; status: PageStatus }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string[] | undefined> }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_CONNECTED'; config: TenantShopifyConfig }
  | { type: 'SET_SYNC_RESULT'; result: { synced: number; archived: number }; lastSyncAt: string }
  | { type: 'SET_DISCONNECTED' }
  | { type: 'LOADED'; config: TenantShopifyConfig };

const initialState: ConnectorState = {
  status: 'loading',
  storeDomain: '',
  adminApiKey: '',
  fieldErrors: {},
  serverError: null,
  shopifyConfig: null,
  syncResult: null,
};

function reducer(state: ConnectorState, action: ConnectorAction): ConnectorState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        [action.field]: action.value,
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
        serverError: null,
      };
    case 'SET_STATUS':
      return { ...state, status: action.status, serverError: null };
    case 'SET_FIELD_ERRORS':
      return { ...state, status: 'disconnected', fieldErrors: action.errors };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    case 'SET_CONNECTED':
      return {
        ...state,
        status: 'connected',
        shopifyConfig: action.config,
        storeDomain: '',
        adminApiKey: '',
        fieldErrors: {},
        serverError: null,
      };
    case 'SET_SYNC_RESULT':
      return {
        ...state,
        status: 'connected',
        syncResult: action.result,
        shopifyConfig: state.shopifyConfig
          ? { ...state.shopifyConfig, lastSyncAt: action.lastSyncAt }
          : null,
      };
    case 'SET_DISCONNECTED':
      return { ...initialState, status: 'disconnected' };
    case 'LOADED':
      return {
        ...state,
        status: action.config.storeDomain ? 'connected' : 'disconnected',
        shopifyConfig: action.config,
      };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────

export function ShopifyConnector() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    status,
    storeDomain,
    adminApiKey,
    fieldErrors,
    serverError,
    shopifyConfig,
    syncResult,
  } = state;

  useEffect(() => {
    async function loadTenantConfig() {
      try {
        const data = await callFunction<{ shopify: TenantShopifyConfig }>('getTenantShopifyConfig');
        dispatch({ type: 'LOADED', config: data.shopify });
      } catch {
        // If function doesn't exist yet, default to disconnected
        dispatch({ type: 'LOADED', config: { storeDomain: null, connectedAt: null, lastSyncAt: null } });
      }
    }
    loadTenantConfig();
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();

    const parsed = shopifyConnectSchema.safeParse({ storeDomain, adminApiKey });
    if (!parsed.success) {
      dispatch({ type: 'SET_FIELD_ERRORS', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    dispatch({ type: 'SET_STATUS', status: 'connecting' });

    try {
      await callFunction('connectShopify', parsed.data);
      dispatch({
        type: 'SET_CONNECTED',
        config: {
          storeDomain: parsed.data.storeDomain,
          connectedAt: new Date().toISOString(),
          lastSyncAt: null,
        },
      });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: error.message || 'Connection failed. Please check your credentials.',
      });
    }
  }

  async function handleSync() {
    dispatch({ type: 'SET_STATUS', status: 'syncing' });

    try {
      const result = await callFunction<{
        success: boolean;
        synced: number;
        archived: number;
      }>('syncShopifyProducts');

      const now = new Date().toISOString();
      dispatch({ type: 'SET_SYNC_RESULT', result, lastSyncAt: now });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: error.message || 'Sync failed. Please try again.',
      });
    }
  }

  async function handleDisconnect() {
    dispatch({ type: 'SET_STATUS', status: 'disconnecting' });

    try {
      await callFunction('disconnectShopify');
      dispatch({ type: 'SET_DISCONNECTED' });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: error.message || 'Disconnect failed.',
      });
    }
  }

  if (status === 'loading') {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-stone-200" />
        <div className="h-32 rounded bg-stone-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-900">Shopify Connector</h1>
        <p className="mt-1 text-sm text-stone-500">
          Connect your Shopify store to import product catalog for AI generation.
        </p>
        <p className="mt-2 text-[11px] text-stone-400">
          Requires a Shopify Admin API access token with <code className="rounded bg-stone-100 px-1">read_products</code> scope. The token is stored securely in Google Cloud Secret Manager.
        </p>
      </div>

      {/* ── Connected State ── */}
      {(status === 'connected' || status === 'syncing') && shopifyConfig?.storeDomain && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold font-display text-green-900">Store Connected</h2>
              <p className="text-sm text-green-700">{shopifyConfig.storeDomain}</p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-green-600">Connected</dt>
              <dd className="font-medium text-green-900">
                {shopifyConfig.connectedAt
                  ? new Date(shopifyConfig.connectedAt).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-green-600">Last Sync</dt>
              <dd className="font-medium text-green-900">
                {shopifyConfig.lastSyncAt
                  ? new Date(shopifyConfig.lastSyncAt).toLocaleString()
                  : 'Never'}
              </dd>
            </div>
          </dl>

          {syncResult && (
            <div className="mt-4 rounded-md bg-green-100 p-3 text-sm text-green-800" role="status">
              Sync complete: {syncResult.synced} products synced
              {syncResult.archived > 0 && `, ${syncResult.archived} archived`}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSync}
              disabled={status === 'syncing'}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'syncing' ? 'Syncing...' : 'Sync Products'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={status === 'syncing'}
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* ── Disconnected / Form State ── */}
      {(status === 'disconnected' || status === 'connecting' || status === 'error') && (
        <form onSubmit={handleConnect} className="rounded-lg border border-stone-200 bg-stone-50 p-6">
          <h2 className="text-lg font-semibold font-display text-stone-900">Connect Your Store</h2>
          <p className="mt-1 text-sm text-stone-500">
            Enter your Shopify store domain and Admin API access token.
          </p>

          <fieldset disabled={status === 'connecting'} className="mt-4 space-y-4">
            <div>
              <label htmlFor="store-domain" className="block text-sm font-medium text-stone-700">
                Store Domain <span className="text-red-500">*</span>
              </label>
              <input
                id="store-domain"
                type="text"
                value={storeDomain}
                onChange={(e) =>
                  dispatch({ type: 'SET_FIELD', field: 'storeDomain', value: e.target.value })
                }
                placeholder="your-store.myshopify.com"
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {fieldErrors.storeDomain && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.storeDomain[0]}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="api-key" className="block text-sm font-medium text-stone-700">
                Admin API Access Token <span className="text-red-500">*</span>
              </label>
              <input
                id="api-key"
                type="password"
                autoComplete="off"
                value={adminApiKey}
                onChange={(e) =>
                  dispatch({ type: 'SET_FIELD', field: 'adminApiKey', value: e.target.value })
                }
                placeholder="shpat_..."
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <p className="mt-1 text-xs text-stone-400">
                Stored securely in Google Cloud Secret Manager. Never saved in the database.
              </p>
              {fieldErrors.adminApiKey && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.adminApiKey[0]}
                </p>
              )}
            </div>
          </fieldset>

          {serverError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          <div className="mt-6">
            <button
              type="submit"
              disabled={status === 'connecting'}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'connecting' ? 'Connecting...' : 'Connect Store'}
            </button>
          </div>
        </form>
      )}

      {/* ── Disconnecting State ── */}
      {status === 'disconnecting' && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-6 text-center">
          <p className="text-stone-600">Disconnecting store...</p>
        </div>
      )}
    </div>
  );
}
