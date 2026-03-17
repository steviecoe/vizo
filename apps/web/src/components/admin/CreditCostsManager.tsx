'use client';

import { useReducer, useEffect, useCallback } from 'react';
import { creditCostsSchema, DEFAULT_CREDIT_COSTS } from '@vizo/shared';
import type { CreditCosts } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────────

type PageStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

interface PageState {
  status: PageStatus;
  costs: Record<keyof CreditCosts, string>;
  fieldErrors: Record<string, string[] | undefined>;
  serverError: string | null;
}

type PageAction =
  | { type: 'SET_LOADED'; costs: CreditCosts }
  | { type: 'SET_FIELD'; field: keyof CreditCosts; value: string }
  | { type: 'SET_SAVING' }
  | { type: 'SET_SAVED'; costs: CreditCosts }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string[] | undefined> };

const costFields: { key: keyof CreditCosts; label: string; group: string }[] = [
  { key: 'quickGen1k', label: 'Quick Gen (1k)', group: 'Quick Generation' },
  { key: 'quickGen2k', label: 'Quick Gen (2k)', group: 'Quick Generation' },
  { key: 'shopifyGen1k', label: 'Shopify Gen (1k)', group: 'Shopify Generation' },
  { key: 'shopifyGen2k', label: 'Shopify Gen (2k)', group: 'Shopify Generation' },
  { key: 'photoshoot1k', label: 'Photoshoot (1k)', group: 'Photoshoot (bulk discount)' },
  { key: 'photoshoot2k', label: 'Photoshoot (2k)', group: 'Photoshoot (bulk discount)' },
  { key: 'modelGeneration', label: 'Model Generation', group: 'Asset Generation' },
  { key: 'backgroundGeneration', label: 'Background Generation', group: 'Asset Generation' },
];

function costsToStrings(costs: CreditCosts): Record<keyof CreditCosts, string> {
  const result = {} as Record<keyof CreditCosts, string>;
  for (const key of Object.keys(costs) as (keyof CreditCosts)[]) {
    result[key] = String(costs[key]);
  }
  return result;
}

function stringsToNumbers(strings: Record<keyof CreditCosts, string>): Record<keyof CreditCosts, number> {
  const result = {} as Record<keyof CreditCosts, number>;
  for (const key of Object.keys(strings) as (keyof CreditCosts)[]) {
    result[key] = parseInt(strings[key], 10) || 0;
  }
  return result;
}

// ─── Reducer ──────────────────────────────────────────────────

const initialState: PageState = {
  status: 'loading',
  costs: costsToStrings(DEFAULT_CREDIT_COSTS),
  fieldErrors: {},
  serverError: null,
};

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case 'SET_LOADED':
      return { ...state, status: 'idle', costs: costsToStrings(action.costs) };
    case 'SET_FIELD':
      return {
        ...state,
        status: state.status === 'saved' ? 'idle' : state.status,
        costs: { ...state.costs, [action.field]: action.value },
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
        serverError: null,
      };
    case 'SET_SAVING':
      return { ...state, status: 'saving', fieldErrors: {}, serverError: null };
    case 'SET_SAVED':
      return { ...state, status: 'saved', costs: costsToStrings(action.costs) };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    case 'SET_FIELD_ERRORS':
      return { ...state, status: 'idle', fieldErrors: action.errors };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────────

export function CreditCostsManager() {
  const [state, dispatch] = useReducer(pageReducer, initialState);
  const { status, costs, fieldErrors, serverError } = state;
  const isDisabled = status === 'saving';

  const fetchCosts = useCallback(async () => {
    try {
      const data = await callFunction<{ creditCosts: CreditCosts }>('getCreditCosts');
      dispatch({ type: 'SET_LOADED', costs: data.creditCosts });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to load credit costs',
      });
    }
  }, []);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const numericCosts = stringsToNumbers(costs);

    const parsed = creditCostsSchema.safeParse(numericCosts);
    if (!parsed.success) {
      dispatch({
        type: 'SET_FIELD_ERRORS',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    dispatch({ type: 'SET_SAVING' });
    try {
      const result = await callFunction<{ creditCosts: CreditCosts }>(
        'updateCreditCosts',
        parsed.data,
      );
      dispatch({ type: 'SET_SAVED', costs: result.creditCosts });
    } catch (err: unknown) {
      const firebaseError = err as { message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: firebaseError.message || 'Failed to save credit costs',
      });
    }
  }

  // Group fields
  const groups = costFields.reduce(
    (acc, field) => {
      if (!acc[field.group]) acc[field.group] = [];
      acc[field.group].push(field);
      return acc;
    },
    {} as Record<string, typeof costFields>,
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-900">Credit Cost Configuration</h1>
          <p className="mt-1 text-sm text-stone-600">
            Set the global credit cost for each AI generation action. These costs
            apply to all tenants.
          </p>
        </div>
      </div>

      {status === 'loading' ? (
        <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-8 text-center text-sm text-stone-500">
          Loading credit costs...
        </div>
      ) : (
        <form onSubmit={handleSave} className="mt-6 rounded-lg border border-stone-200 bg-stone-50">
          <div className="divide-y divide-stone-100">
            {Object.entries(groups).map(([groupName, fields]) => (
              <div key={groupName} className="px-6 py-5">
                <h3 className="mb-3 text-sm font-semibold font-display text-stone-800">
                  {groupName}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {fields.map(({ key, label }) => (
                    <div key={key}>
                      <label
                        htmlFor={`cost-${key}`}
                        className="block text-sm font-medium text-stone-600"
                      >
                        {label}
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          id={`cost-${key}`}
                          type="number"
                          min="1"
                          step="1"
                          value={costs[key]}
                          onChange={(e) =>
                            dispatch({
                              type: 'SET_FIELD',
                              field: key,
                              value: e.target.value,
                            })
                          }
                          disabled={isDisabled}
                          className="block w-24 rounded-md border border-stone-300 px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                        />
                        <span className="text-xs text-stone-400">credits</span>
                      </div>
                      {fieldErrors[key] && (
                        <p className="mt-1 text-xs text-red-600" role="alert">
                          {fieldErrors[key]![0]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {serverError && (
            <div className="mx-6 mb-4 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {status === 'saved' && (
            <div className="mx-6 mb-4 rounded-md border border-green-200 bg-green-50 p-3" role="status">
              <p className="text-sm text-green-700">Credit costs saved successfully.</p>
            </div>
          )}

          <div className="flex justify-end border-t border-stone-200 px-6 py-4">
            <button
              type="submit"
              disabled={isDisabled}
              className="rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDisabled ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
