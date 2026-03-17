'use client';

import { useReducer, useRef } from 'react';
import { createTenantSchema } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────────

interface CreateTenantResult {
  success: boolean;
  tenantId: string;
  message: string;
}

type FormStatus = 'idle' | 'creating' | 'success' | 'error';

interface FormFields {
  name: string;
  slug: string;
  pricePerCredit: string;
  shopifyIntegration: boolean;
  photoshootMode: boolean;
  quickGeneration: boolean;
  defaultBrief: string;
  geminiApiKey: string;
}

interface FormState {
  status: FormStatus;
  fields: FormFields;
  adminEmails: string[];
  emailInput: string;
  slugTouched: boolean;
  fieldErrors: Record<string, string[] | undefined>;
  serverError: string | null;
  result: CreateTenantResult | null;
  lastSubmission: FormFields & { adminEmails: string[] } | null;
}

// ─── Actions ──────────────────────────────────────────────────

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormFields; value: string | boolean }
  | { type: 'SET_NAME_WITH_SLUG'; name: string }
  | { type: 'TOUCH_SLUG' }
  | { type: 'SET_EMAIL_INPUT'; value: string }
  | { type: 'ADD_EMAIL' }
  | { type: 'REMOVE_EMAIL'; index: number }
  | { type: 'SET_CREATING'; lastSubmission: FormState['lastSubmission'] }
  | { type: 'SET_SUCCESS'; result: CreateTenantResult }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string[] | undefined> }
  | { type: 'RESET' };

// ─── Initial state ────────────────────────────────────────────

const initialFields: FormFields = {
  name: '',
  slug: '',
  pricePerCredit: '',
  shopifyIntegration: true,
  photoshootMode: true,
  quickGeneration: true,
  defaultBrief: '',
  geminiApiKey: '',
};

const initialState: FormState = {
  status: 'idle',
  fields: { ...initialFields },
  adminEmails: [],
  emailInput: '',
  slugTouched: false,
  fieldErrors: {},
  serverError: null,
  result: null,
  lastSubmission: null,
};

// ─── Helpers ──────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function mapServerError(code: string | undefined, message: string): string {
  switch (code) {
    case 'functions/already-exists':
      return 'A tenant with this slug already exists. Choose a different slug.';
    case 'functions/unauthenticated':
    case 'functions/permission-denied':
      return 'Your session has expired. Please sign in again.';
    default:
      return message || 'An unexpected error occurred. Please try again.';
  }
}

// ─── Reducer ──────────────────────────────────────────────────

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        fields: { ...state.fields, [action.field]: action.value },
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
        serverError: null,
      };

    case 'SET_NAME_WITH_SLUG': {
      const newFields = { ...state.fields, name: action.name };
      if (!state.slugTouched) {
        newFields.slug = toSlug(action.name);
      }
      return {
        ...state,
        fields: newFields,
        fieldErrors: {
          ...state.fieldErrors,
          name: undefined,
          slug: state.slugTouched ? state.fieldErrors.slug : undefined,
        },
        serverError: null,
      };
    }

    case 'TOUCH_SLUG':
      return { ...state, slugTouched: true };

    case 'SET_EMAIL_INPUT':
      return { ...state, emailInput: action.value };

    case 'ADD_EMAIL': {
      const email = state.emailInput.trim().toLowerCase();
      if (!email || state.adminEmails.includes(email)) {
        return state;
      }
      return {
        ...state,
        adminEmails: [...state.adminEmails, email],
        emailInput: '',
        fieldErrors: { ...state.fieldErrors, adminEmails: undefined },
      };
    }

    case 'REMOVE_EMAIL':
      return {
        ...state,
        adminEmails: state.adminEmails.filter((_, i) => i !== action.index),
      };

    case 'SET_CREATING':
      return {
        ...state,
        status: 'creating',
        fieldErrors: {},
        serverError: null,
        lastSubmission: action.lastSubmission,
      };

    case 'SET_SUCCESS':
      return {
        ...state,
        status: 'success',
        result: action.result,
        // Clear the API key from form memory
        fields: { ...state.fields, geminiApiKey: '' },
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

export interface CreateTenantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTenantDialog({ isOpen, onClose, onCreated }: CreateTenantDialogProps) {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const { status, fields, adminEmails, emailInput, fieldErrors, serverError, result, lastSubmission } = state;
  const isDisabled = status === 'creating';

  function handleClose() {
    dispatch({ type: 'RESET' });
    onClose();
  }

  function handleAddEmail(e?: React.FormEvent) {
    e?.preventDefault();
    dispatch({ type: 'ADD_EMAIL' });
    emailInputRef.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      name: fields.name,
      slug: fields.slug,
      pricePerCredit: parseFloat(fields.pricePerCredit) || 0,
      allowedFeatures: {
        shopifyIntegration: fields.shopifyIntegration,
        photoshootMode: fields.photoshootMode,
        quickGeneration: fields.quickGeneration,
      },
      adminEmails,
      geminiApiKey: fields.geminiApiKey,
      ...(fields.defaultBrief
        ? { artDirection: { defaultBrief: fields.defaultBrief } }
        : {}),
    };

    // Client-side validation with shared schema
    const parsed = createTenantSchema.safeParse(payload);
    if (!parsed.success) {
      dispatch({
        type: 'SET_FIELD_ERRORS',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    dispatch({
      type: 'SET_CREATING',
      lastSubmission: { ...fields, adminEmails: [...adminEmails] },
    });

    try {
      const data = await callFunction<CreateTenantResult>(
        'createTenant',
        parsed.data,
      );
      dispatch({ type: 'SET_SUCCESS', result: data });
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: mapServerError(firebaseError.code, firebaseError.message ?? ''),
      });
    }
  }

  if (!isOpen) return null;

  // ── Success View ──────────────────────────────────

  if (status === 'success' && result && lastSubmission) {
    return (
      <div className="fixed inset-0 z-50" role="dialog" aria-label="Tenant created">
        <div className="fixed inset-0 bg-black/50" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold font-display text-stone-900">
                Tenant Created Successfully
              </h2>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-500">Tenant Name</dt>
                <dd className="font-medium text-stone-900">{lastSubmission.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Tenant ID</dt>
                <dd className="font-mono text-xs text-stone-700">{result.tenantId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Slug</dt>
                <dd className="text-stone-700">{lastSubmission.slug}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Price / Credit</dt>
                <dd className="text-stone-700">
                  &pound;{lastSubmission.pricePerCredit}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Credit Balance</dt>
                <dd className="text-stone-700">0 (use Admin Top-up)</dd>
              </div>
              <div>
                <dt className="text-stone-500">Invited Admins</dt>
                <dd className="mt-1">
                  <ul className="list-inside list-disc text-stone-700">
                    {lastSubmission.adminEmails.map((email) => (
                      <li key={email}>{email}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">API Key</dt>
                <dd className="text-stone-700">Stored in GCP Secret Manager</dd>
              </div>
            </dl>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  handleClose();
                  onCreated();
                }}
                className="flex-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form View (idle / creating / error) ───────────

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Create tenant">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-2xl rounded-lg bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-stone-200 px-6 py-4">
            <h2 className="text-lg font-semibold font-display text-stone-900">
              Create New Tenant
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto px-6 py-4">
            {/* Section: Identity */}
            <fieldset disabled={isDisabled} className="space-y-4">
              <legend className="text-sm font-medium text-stone-700">
                Tenant Identity
              </legend>

              <div>
                <label htmlFor="tenant-name" className="block text-sm font-medium text-stone-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="tenant-name"
                  type="text"
                  value={fields.name}
                  onChange={(e) =>
                    dispatch({ type: 'SET_NAME_WITH_SLUG', name: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Fashion Brand Co"
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.name[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="tenant-slug" className="block text-sm font-medium text-stone-700">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  id="tenant-slug"
                  type="text"
                  value={fields.slug}
                  onChange={(e) => {
                    dispatch({ type: 'TOUCH_SLUG' });
                    dispatch({ type: 'SET_FIELD', field: 'slug', value: e.target.value });
                  }}
                  className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="fashion-brand-co"
                />
                <p className="mt-1 text-xs text-stone-400">
                  Lowercase, hyphens only. Auto-generated from name.
                </p>
                {fieldErrors.slug && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.slug[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="tenant-price" className="block text-sm font-medium text-stone-700">
                  Price per Credit (&pound;) <span className="text-red-500">*</span>
                </label>
                <input
                  id="tenant-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={fields.pricePerCredit}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FIELD', field: 'pricePerCredit', value: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="0.50"
                />
                {fieldErrors.pricePerCredit && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.pricePerCredit[0]}</p>
                )}
              </div>
            </fieldset>

            {/* Section: Features */}
            <fieldset disabled={isDisabled} className="mt-6 space-y-3">
              <legend className="text-sm font-medium text-stone-700">
                Allowed Features
              </legend>
              {(
                [
                  ['shopifyIntegration', 'Shopify Integration'],
                  ['photoshootMode', 'Photoshoot Mode'],
                  ['quickGeneration', 'Quick Generation'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fields[key]}
                    onChange={(e) =>
                      dispatch({ type: 'SET_FIELD', field: key, value: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-stone-700">{label}</span>
                </label>
              ))}
            </fieldset>

            {/* Section: Art Direction */}
            <fieldset disabled={isDisabled} className="mt-6 space-y-3">
              <legend className="text-sm font-medium text-stone-700">
                Default Art Direction (optional)
              </legend>
              <textarea
                value={fields.defaultBrief}
                onChange={(e) =>
                  dispatch({ type: 'SET_FIELD', field: 'defaultBrief', value: e.target.value })
                }
                rows={3}
                maxLength={2000}
                className="block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="High-end editorial fashion photography style..."
              />
            </fieldset>

            {/* Section: Gemini API Key */}
            <fieldset disabled={isDisabled} className="mt-6 space-y-3">
              <legend className="text-sm font-medium text-stone-700">
                Gemini API Key
              </legend>
              <div>
                <input
                  id="tenant-api-key"
                  type="password"
                  autoComplete="off"
                  value={fields.geminiApiKey}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FIELD', field: 'geminiApiKey', value: e.target.value })
                  }
                  className="block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Enter Gemini Nano Banana Pro 2 API key"
                />
                <p className="mt-1 text-xs text-stone-400">
                  Stored securely in GCP Secret Manager. Never saved in the database.
                </p>
                {fieldErrors.geminiApiKey && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.geminiApiKey[0]}</p>
                )}
              </div>
            </fieldset>

            {/* Section: Admin Emails */}
            <fieldset disabled={isDisabled} className="mt-6 space-y-3">
              <legend className="text-sm font-medium text-stone-700">
                Tenant Admin Emails <span className="text-red-500">*</span>
              </legend>
              <div className="flex gap-2">
                <input
                  ref={emailInputRef}
                  type="email"
                  value={emailInput}
                  onChange={(e) =>
                    dispatch({ type: 'SET_EMAIL_INPUT', value: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEmail();
                    }
                  }}
                  className="block flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="admin@brand.com"
                />
                <button
                  type="button"
                  onClick={() => handleAddEmail()}
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Add
                </button>
              </div>
              {adminEmails.length > 0 && (
                <ul className="space-y-1">
                  {adminEmails.map((email, i) => (
                    <li
                      key={email}
                      className="flex items-center justify-between rounded bg-stone-50 px-3 py-1.5 text-sm"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'REMOVE_EMAIL', index: i })}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Remove ${email}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {fieldErrors.adminEmails && (
                <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.adminEmails[0]}</p>
              )}
            </fieldset>

            {/* Server Error */}
            {serverError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
                <p className="text-sm text-red-700">{serverError}</p>
              </div>
            )}
          </form>

          {/* Footer */}
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
              {isDisabled ? 'Creating...' : 'Create Tenant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
