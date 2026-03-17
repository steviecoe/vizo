'use client';

import { useReducer, useEffect, useState, useRef, useCallback } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase/client';
import { updateTenantSchema } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';
import type { Tenant } from '@vizo/shared';

// ─── Types ────────────────────────────────────────────────────

type FormStatus = 'idle' | 'saving' | 'success' | 'error';

interface FormFields {
  name: string;
  slug: string;
  pricePerCredit: string;
  lowCreditThreshold: string;
  shopifyIntegration: boolean;
  photoshootMode: boolean;
  quickGeneration: boolean;
  defaultBrief: string;
  quickGenBrief: string;
  shopifyGenBrief: string;
  photoshootBrief: string;
  status: 'active' | 'suspended';
  geminiApiKey: string;
}

interface FormState {
  status: FormStatus;
  fields: FormFields;
  fieldErrors: Record<string, string[] | undefined>;
  serverError: string | null;
}

interface TenantUserRow {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
}

// ─── Actions ──────────────────────────────────────────────────

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormFields; value: string | boolean }
  | { type: 'INIT'; fields: FormFields }
  | { type: 'SET_SAVING' }
  | { type: 'SET_SUCCESS' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string[] | undefined> }
  | { type: 'RESET' };

const emptyFields: FormFields = {
  name: '',
  slug: '',
  pricePerCredit: '',
  lowCreditThreshold: '',
  shopifyIntegration: true,
  photoshootMode: true,
  quickGeneration: true,
  defaultBrief: '',
  quickGenBrief: '',
  shopifyGenBrief: '',
  photoshootBrief: '',
  status: 'active',
  geminiApiKey: '',
};

const initialState: FormState = {
  status: 'idle',
  fields: { ...emptyFields },
  fieldErrors: {},
  serverError: null,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        fields: { ...state.fields, [action.field]: action.value },
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
        serverError: null,
      };
    case 'INIT':
      return { ...initialState, fields: action.fields };
    case 'SET_SAVING':
      return { ...state, status: 'saving', fieldErrors: {}, serverError: null };
    case 'SET_SUCCESS':
      return { ...state, status: 'success' };
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

export interface EditTenantDialogProps {
  tenant: (Tenant & { id: string }) | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

export function EditTenantDialog({ tenant, onClose, onSaved, onDeleted }: EditTenantDialogProps) {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const { status, fields, fieldErrors, serverError } = state;
  const isDisabled = status === 'saving';

  // ── User management state ──
  const [users, setUsers] = useState<TenantUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'tenant_admin' | 'tenant_user'>('tenant_admin');
  const [inviting, setInviting] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [sendingInviteUid, setSendingInviteUid] = useState<string | null>(null);
  const [inviteSentEmails, setInviteSentEmails] = useState<Set<string>>(new Set());
  const [userError, setUserError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // ── Delete state ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async (tenantId: string) => {
    setUsersLoading(true);
    setUserError(null);
    try {
      const data = await callFunction<{ users: TenantUserRow[] }>('listTenantUsers', { tenantId });
      setUsers(data.users);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setUserError(error.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tenant) {
      dispatch({
        type: 'INIT',
        fields: {
          name: tenant.name,
          slug: tenant.slug,
          pricePerCredit: String(tenant.pricePerCredit),
          lowCreditThreshold: String(tenant.lowCreditThreshold ?? 50),
          shopifyIntegration: tenant.allowedFeatures?.shopifyIntegration ?? true,
          photoshootMode: tenant.allowedFeatures?.photoshootMode ?? true,
          quickGeneration: tenant.allowedFeatures?.quickGeneration ?? true,
          defaultBrief: tenant.artDirection?.defaultBrief ?? '',
          quickGenBrief: tenant.artDirection?.quickGenBrief ?? '',
          shopifyGenBrief: tenant.artDirection?.shopifyGenBrief ?? '',
          photoshootBrief: tenant.artDirection?.photoshootBrief ?? '',
          status: tenant.status ?? 'active',
          geminiApiKey: '',
        },
      });
      setUsers([]);
      setUserError(null);
      setInviteEmail('');
      fetchUsers(tenant.id);
    }
  }, [tenant, fetchUsers]);

  function handleClose() {
    dispatch({ type: 'RESET' });
    setUsers([]);
    setUserError(null);
    setInviteEmail('');
    setInviteSentEmails(new Set());
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
    onClose();
  }

  async function handleDeleteTenant() {
    if (!tenant || deleteConfirmText !== tenant.name) return;
    setDeleting(true);
    try {
      await callFunction('deleteTenant', { tenantId: tenant.id });
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      onDeleted?.();
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to delete tenant' });
      setDeleting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;

    const payload: Record<string, unknown> = {
      tenantId: tenant.id,
      name: fields.name,
      slug: fields.slug,
      pricePerCredit: parseFloat(fields.pricePerCredit) || 0,
      lowCreditThreshold: parseInt(fields.lowCreditThreshold, 10) || 50,
      allowedFeatures: {
        shopifyIntegration: fields.shopifyIntegration,
        photoshootMode: fields.photoshootMode,
        quickGeneration: fields.quickGeneration,
      },
      artDirection: {
        defaultBrief: fields.defaultBrief,
        quickGenBrief: fields.quickGenBrief,
        shopifyGenBrief: fields.shopifyGenBrief,
        photoshootBrief: fields.photoshootBrief,
      },
      status: fields.status,
    };

    if (fields.geminiApiKey) {
      payload.geminiApiKey = fields.geminiApiKey;
    }

    const parsed = updateTenantSchema.safeParse(payload);
    if (!parsed.success) {
      dispatch({
        type: 'SET_FIELD_ERRORS',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    dispatch({ type: 'SET_SAVING' });

    try {
      await callFunction('updateTenant', parsed.data);
      dispatch({ type: 'SET_SUCCESS' });
      onSaved();
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      const message =
        firebaseError.code === 'functions/already-exists'
          ? 'A tenant with this slug already exists.'
          : firebaseError.message || 'Failed to update tenant.';
      dispatch({ type: 'SET_ERROR', error: message });
    }
  }

  // ── User actions ──

  async function handleInviteUser() {
    if (!tenant || !inviteEmail.trim()) return;
    setInviting(true);
    setUserError(null);

    try {
      await callFunction('inviteTenantUser', {
        tenantId: tenant.id,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      });
      setInviteEmail('');
      await fetchUsers(tenant.id);
      emailInputRef.current?.focus();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setUserError(error.message || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveUser(uid: string) {
    if (!tenant) return;
    setRemovingUid(uid);
    setUserError(null);

    try {
      await callFunction('removeTenantUser', { tenantId: tenant.id, uid });
      await fetchUsers(tenant.id);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setUserError(error.message || 'Failed to remove user');
    } finally {
      setRemovingUid(null);
    }
  }

  async function handleSendInviteEmail(uid: string, email: string) {
    setSendingInviteUid(uid);
    setUserError(null);
    try {
      const auth = getClientAuth();
      await sendPasswordResetEmail(auth, email);
      setInviteSentEmails((prev) => new Set(prev).add(email));
    } catch {
      setUserError(`Failed to send invite email to ${email}`);
    } finally {
      setSendingInviteUid(null);
    }
  }

  if (!tenant) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Edit tenant">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-2xl rounded-lg bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-stone-200 px-6 py-4">
            <h2 className="text-lg font-semibold font-display text-stone-900">
              Edit Tenant: {tenant.name}
            </h2>
            <p className="mt-0.5 text-xs text-stone-400">ID: {tenant.id}</p>
          </div>

          <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto px-6 py-4">
            {/* Section: Identity */}
            <fieldset disabled={isDisabled} className="space-y-4">
              <legend className="text-sm font-medium text-stone-700">
                Tenant Identity
              </legend>

              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-stone-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={fields.name}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'name', value: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.name[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="edit-slug" className="block text-sm font-medium text-stone-700">
                  Slug
                </label>
                <input
                  id="edit-slug"
                  type="text"
                  value={fields.slug}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'slug', value: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                {fieldErrors.slug && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.slug[0]}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-price" className="block text-sm font-medium text-stone-700">
                    Price per Credit (&pound;)
                  </label>
                  <input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={fields.pricePerCredit}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'pricePerCredit', value: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  {fieldErrors.pricePerCredit && (
                    <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.pricePerCredit[0]}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="edit-threshold" className="block text-sm font-medium text-stone-700">
                    Low Credit Threshold
                  </label>
                  <input
                    id="edit-threshold"
                    type="number"
                    min="0"
                    value={fields.lowCreditThreshold}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'lowCreditThreshold', value: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label htmlFor="edit-status" className="block text-sm font-medium text-stone-700">
                  Status
                </label>
                <select
                  id="edit-status"
                  value={fields.status}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'status', value: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
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

            {/* Section: Users */}
            <fieldset className="mt-6 space-y-3">
              <legend className="text-sm font-medium text-stone-700">
                Tenant Users
              </legend>

              {/* Invite form */}
              <div className="flex gap-2">
                <input
                  ref={emailInputRef}
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInviteUser();
                    }
                  }}
                  placeholder="user@example.com"
                  disabled={inviting}
                  className="block flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'tenant_admin' | 'tenant_user')}
                  disabled={inviting}
                  className="rounded-md border border-stone-300 px-2 py-2 text-sm disabled:opacity-50"
                >
                  <option value="tenant_admin">Admin</option>
                  <option value="tenant_user">User</option>
                </select>
                <button
                  type="button"
                  onClick={handleInviteUser}
                  disabled={inviting || !inviteEmail.trim()}
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  {inviting ? 'Adding...' : 'Add'}
                </button>
              </div>

              {userError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2">
                  <p className="text-xs text-red-700">{userError}</p>
                </div>
              )}

              {/* User list */}
              {usersLoading ? (
                <p className="text-xs text-stone-400">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="text-xs text-stone-400">No users in this tenant yet.</p>
              ) : (
                <ul className="space-y-1">
                  {users.map((user) => (
                    <li
                      key={user.uid}
                      className="flex items-center justify-between rounded bg-stone-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-stone-900">{user.email}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          user.role === 'tenant_admin'
                            ? 'bg-blue-100 text-stone-950'
                            : 'bg-stone-100 text-stone-600'
                        }`}>
                          {user.role === 'tenant_admin' ? 'Admin' : 'User'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {inviteSentEmails.has(user.email) ? (
                          <span className="text-xs text-green-600">Sent</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendInviteEmail(user.uid, user.email)}
                            disabled={sendingInviteUid === user.uid}
                            className="text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
                          >
                            {sendingInviteUid === user.uid ? 'Sending...' : 'Send invite'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveUser(user.uid)}
                          disabled={removingUid === user.uid}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          {removingUid === user.uid ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            {/* Section: Art Direction */}
            <fieldset disabled={isDisabled} className="mt-6 space-y-3">
              <legend className="text-sm font-medium text-stone-700">
                Art Direction Briefs
              </legend>
              {(
                [
                  ['defaultBrief', 'Default Brief'],
                  ['quickGenBrief', 'Quick Generation Brief'],
                  ['shopifyGenBrief', 'Shopify Generation Brief'],
                  ['photoshootBrief', 'Photoshoot Brief'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={`edit-${key}`} className="block text-xs font-medium text-stone-600">
                    {label}
                  </label>
                  <textarea
                    id={`edit-${key}`}
                    value={fields[key]}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', field: key, value: e.target.value })}
                    rows={2}
                    maxLength={2000}
                    className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              ))}
            </fieldset>

            {/* Section: Gemini API Key */}
            <fieldset disabled={isDisabled} className="mt-6 space-y-3">
              <legend className="text-sm font-medium text-stone-700">
                Gemini API Key
              </legend>
              <div>
                <input
                  id="edit-api-key"
                  type="password"
                  autoComplete="off"
                  value={fields.geminiApiKey}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'geminiApiKey', value: e.target.value })}
                  className="block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Leave empty to keep current key"
                />
                <p className="mt-1 text-xs text-stone-400">
                  Only fill in to replace the existing key. Stored in GCP Secret Manager.
                </p>
              </div>
            </fieldset>

            {/* Section: Danger Zone */}
            <fieldset className="mt-6 space-y-3 rounded-md border border-red-200 bg-red-50/50 p-4">
              <legend className="text-sm font-medium text-red-700">
                Danger Zone
              </legend>
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete Tenant
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-700">
                    This will permanently delete the tenant, all its users, and associated data.
                    Type <strong>{tenant.name}</strong> to confirm.
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={tenant.name}
                    className="block w-full rounded-md border border-red-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteTenant}
                      disabled={deleting || deleteConfirmText !== tenant.name}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Permanently Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                      className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </fieldset>

            {/* Server Error */}
            {serverError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
                <p className="text-sm text-red-700">{serverError}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3" role="status">
                <p className="text-sm text-green-700">Tenant updated successfully.</p>
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
              {status === 'success' ? 'Close' : 'Cancel'}
            </button>
            {status !== 'success' && (
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isDisabled}
                className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDisabled ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
