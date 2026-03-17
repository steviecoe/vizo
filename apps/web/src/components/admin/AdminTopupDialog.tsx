'use client';

import { useReducer } from 'react';
import { adminCreditTopupSchema } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';
import type { Tenant } from '@vizo/shared';

// ─── Types ────────────────────────────────────────────────────

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

interface TopupResult {
  success: boolean;
  ledgerEntryId: string;
}

interface FormState {
  status: FormStatus;
  creditAmount: string;
  description: string;
  fieldErrors: Record<string, string[] | undefined>;
  serverError: string | null;
  result: TopupResult | null;
  grantedAmount: number | null;
}

type FormAction =
  | { type: 'SET_FIELD'; field: 'creditAmount' | 'description'; value: string }
  | { type: 'SET_SUBMITTING' }
  | { type: 'SET_SUCCESS'; result: TopupResult; amount: number }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string[] | undefined> }
  | { type: 'RESET' };

// ─── State ────────────────────────────────────────────────────

const initialState: FormState = {
  status: 'idle',
  creditAmount: '',
  description: '',
  fieldErrors: {},
  serverError: null,
  result: null,
  grantedAmount: null,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        [action.field]: action.value,
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
        serverError: null,
      };
    case 'SET_SUBMITTING':
      return { ...state, status: 'submitting', fieldErrors: {}, serverError: null };
    case 'SET_SUCCESS':
      return {
        ...state,
        status: 'success',
        result: action.result,
        grantedAmount: action.amount,
      };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    case 'SET_FIELD_ERRORS':
      return { ...state, status: 'idle', fieldErrors: action.errors };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────────

export interface AdminTopupDialogProps {
  tenant: (Tenant & { id: string }) | null;
  onClose: () => void;
  onCompleted: () => void;
}

export function AdminTopupDialog({ tenant, onClose, onCompleted }: AdminTopupDialogProps) {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const { status, creditAmount, description, fieldErrors, serverError, result, grantedAmount } = state;
  const isDisabled = status === 'submitting';

  function handleClose() {
    dispatch({ type: 'RESET' });
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;

    const payload = {
      tenantId: tenant.id,
      creditAmount: parseInt(creditAmount, 10) || 0,
      description: description.trim(),
    };

    const parsed = adminCreditTopupSchema.safeParse(payload);
    if (!parsed.success) {
      dispatch({
        type: 'SET_FIELD_ERRORS',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    dispatch({ type: 'SET_SUBMITTING' });

    try {
      const data = await callFunction<TopupResult>('adminTopupCredits', parsed.data);
      dispatch({ type: 'SET_SUCCESS', result: data, amount: parsed.data.creditAmount });
    } catch (err: unknown) {
      const firebaseError = err as { message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: firebaseError.message || 'Top-up failed. Please try again.',
      });
    }
  }

  if (!tenant) return null;

  // ── Success View ──

  if (status === 'success' && result) {
    return (
      <div className="fixed inset-0 z-50" role="dialog" aria-label="Top-up complete">
        <div className="fixed inset-0 bg-black/50" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold font-display text-stone-900">
                Credits Added
              </h2>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-500">Tenant</dt>
                <dd className="font-medium text-stone-900">{tenant.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Credits Added</dt>
                <dd className="font-semibold text-green-700">
                  +{grantedAmount?.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">New Balance</dt>
                <dd className="font-medium text-stone-900">
                  {(tenant.creditBalance + (grantedAmount ?? 0)).toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Ledger Entry</dt>
                <dd className="font-mono text-xs text-stone-500">{result.ledgerEntryId}</dd>
              </div>
            </dl>

            <button
              onClick={() => {
                handleClose();
                onCompleted();
              }}
              className="mt-6 w-full rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form View ──

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Top up credits">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-lg bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-stone-200 px-6 py-4">
            <h2 className="text-lg font-semibold font-display text-stone-900">
              Top Up Credits
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Add credits to <strong>{tenant.name}</strong>
            </p>
            <p className="text-xs text-stone-400">
              Current balance: {tenant.creditBalance.toLocaleString()} credits
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-4">
            <fieldset disabled={isDisabled} className="space-y-4">
              <div>
                <label htmlFor="topup-amount" className="block text-sm font-medium text-stone-700">
                  Credit Amount <span className="text-red-500">*</span>
                </label>
                <input
                  id="topup-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={creditAmount}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FIELD', field: 'creditAmount', value: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="500"
                />
                {fieldErrors.creditAmount && (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {fieldErrors.creditAmount[0]}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="topup-description" className="block text-sm font-medium text-stone-700">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  id="topup-description"
                  type="text"
                  value={description}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FIELD', field: 'description', value: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Free trial top-up"
                />
                {fieldErrors.description && (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {fieldErrors.description[0]}
                  </p>
                )}
              </div>
            </fieldset>

            {serverError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
                <p className="text-sm text-red-700">{serverError}</p>
              </div>
            )}
          </form>

          <div className="flex justify-end gap-3 border-t border-stone-200 px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDisabled}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isDisabled}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDisabled ? 'Adding...' : 'Add Credits'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
