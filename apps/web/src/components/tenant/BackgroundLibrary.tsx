'use client';

import { useReducer, useEffect } from 'react';
import { artDirectionBackgroundSchema } from '@vizo/shared';
import type { ArtDirectionBackground } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────

type PageStatus = 'loading' | 'idle' | 'creating' | 'editing' | 'deleting' | 'error';

interface LibraryState {
  status: PageStatus;
  backgrounds: (ArtDirectionBackground & { id: string })[];
  editingBg: (ArtDirectionBackground & { id: string }) | null;
  showForm: boolean;
  formData: BgFormData;
  fieldErrors: Record<string, string[] | undefined>;
  serverError: string | null;
}

interface BgFormData {
  name: string;
  type: 'studio' | 'outdoor' | 'campaign' | 'custom';
  description: string;
}

type LibraryAction =
  | { type: 'SET_LOADED'; backgrounds: (ArtDirectionBackground & { id: string })[] }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SHOW_CREATE_FORM' }
  | { type: 'SHOW_EDIT_FORM'; bg: ArtDirectionBackground & { id: string } }
  | { type: 'HIDE_FORM' }
  | { type: 'SET_FORM_FIELD'; field: keyof BgFormData; value: string }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string[] | undefined> }
  | { type: 'SET_STATUS'; status: PageStatus }
  | { type: 'BG_CREATED'; bg: ArtDirectionBackground & { id: string } }
  | { type: 'BG_UPDATED'; bg: ArtDirectionBackground & { id: string } }
  | { type: 'BG_DELETED'; id: string };

const emptyForm: BgFormData = { name: '', type: 'studio', description: '' };

const initialState: LibraryState = {
  status: 'loading',
  backgrounds: [],
  editingBg: null,
  showForm: false,
  formData: { ...emptyForm },
  fieldErrors: {},
  serverError: null,
};

function reducer(state: LibraryState, action: LibraryAction): LibraryState {
  switch (action.type) {
    case 'SET_LOADED':
      return { ...state, status: 'idle', backgrounds: action.backgrounds };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    case 'SHOW_CREATE_FORM':
      return { ...state, showForm: true, editingBg: null, formData: { ...emptyForm }, fieldErrors: {}, serverError: null };
    case 'SHOW_EDIT_FORM':
      return {
        ...state, showForm: true, editingBg: action.bg,
        formData: { name: action.bg.name, type: action.bg.type, description: action.bg.description },
        fieldErrors: {}, serverError: null,
      };
    case 'HIDE_FORM':
      return { ...state, showForm: false, editingBg: null, formData: { ...emptyForm }, fieldErrors: {}, serverError: null, status: 'idle' };
    case 'SET_FORM_FIELD':
      return { ...state, formData: { ...state.formData, [action.field]: action.value }, fieldErrors: { ...state.fieldErrors, [action.field]: undefined }, serverError: null };
    case 'SET_FIELD_ERRORS':
      return { ...state, status: 'idle', fieldErrors: action.errors };
    case 'SET_STATUS':
      return { ...state, status: action.status, serverError: null };
    case 'BG_CREATED':
      return { ...state, status: 'idle', showForm: false, backgrounds: [action.bg, ...state.backgrounds], formData: { ...emptyForm } };
    case 'BG_UPDATED':
      return { ...state, status: 'idle', showForm: false, editingBg: null, backgrounds: state.backgrounds.map((b) => (b.id === action.bg.id ? action.bg : b)) };
    case 'BG_DELETED':
      return { ...state, status: 'idle', backgrounds: state.backgrounds.filter((b) => b.id !== action.id) };
    default:
      return state;
  }
}

const BG_TYPES = [
  { value: 'studio', label: 'Studio' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'custom', label: 'Custom' },
] as const;

// ─── Component ────────────────────────────────────────────

export function BackgroundLibrary() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, backgrounds, showForm, editingBg, formData, fieldErrors, serverError } = state;
  const isSubmitting = status === 'creating' || status === 'editing';

  useEffect(() => {
    async function load() {
      try {
        const data = await callFunction<{ backgrounds: (ArtDirectionBackground & { id: string })[] }>('listBackgrounds');
        dispatch({ type: 'SET_LOADED', backgrounds: data.backgrounds });
      } catch (err: unknown) {
        dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Failed to load backgrounds' });
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = artDirectionBackgroundSchema.safeParse(formData);
    if (!parsed.success) {
      dispatch({ type: 'SET_FIELD_ERRORS', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    if (editingBg) {
      dispatch({ type: 'SET_STATUS', status: 'editing' });
      try {
        await callFunction('updateBackground', { id: editingBg.id, ...parsed.data });
        dispatch({ type: 'BG_UPDATED', bg: { ...editingBg, ...parsed.data } });
      } catch (err: unknown) {
        dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Update failed' });
      }
    } else {
      dispatch({ type: 'SET_STATUS', status: 'creating' });
      try {
        const result = await callFunction<{ id: string }>('createBackground', parsed.data);
        const newBg = {
          ...parsed.data,
          id: result.id,
          referenceImageUrl: null,
          generatedAt: null,
          createdAt: new Date().toISOString(),
          createdBy: '',
        } as ArtDirectionBackground & { id: string };
        dispatch({ type: 'BG_CREATED', bg: newBg });
      } catch (err: unknown) {
        dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Create failed' });
      }
    }
  }

  async function handleDelete(id: string) {
    dispatch({ type: 'SET_STATUS', status: 'deleting' });
    try {
      await callFunction('deleteBackground', { id });
      dispatch({ type: 'BG_DELETED', id });
    } catch (err: unknown) {
      dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Delete failed' });
    }
  }

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (<div key={i} className="h-28 animate-pulse rounded-lg bg-stone-200" />))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-900">Background Library</h1>
          <p className="mt-1 text-sm text-stone-500">Define reusable backgrounds and settings for AI generation.</p>
        </div>
        {!showForm && (
          <button onClick={() => dispatch({ type: 'SHOW_CREATE_FORM' })} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
            Add Background
          </button>
        )}
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-stone-200 bg-stone-50 p-6">
          <h2 className="text-lg font-semibold font-display text-stone-900">
            {editingBg ? 'Edit Background' : 'Create Background'}
          </h2>

          <fieldset disabled={isSubmitting} className="mt-4 space-y-4">
            <div>
              <label htmlFor="bg-name" className="block text-sm font-medium text-stone-700">Name</label>
              <input id="bg-name" type="text" value={formData.name} onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'name', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.name[0]}</p>}
            </div>

            <div>
              <label htmlFor="bg-type" className="block text-sm font-medium text-stone-700">Type</label>
              <select id="bg-type" value={formData.type} onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'type', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm">
                {BG_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </div>

            <div>
              <label htmlFor="bg-description" className="block text-sm font-medium text-stone-700">Description</label>
              <textarea id="bg-description" rows={3} value={formData.description} onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'description', value: e.target.value })} placeholder="Describe the background setting..." className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              {fieldErrors.description && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.description[0]}</p>}
            </div>
          </fieldset>

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={isSubmitting} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50">
              {isSubmitting ? 'Saving...' : editingBg ? 'Update Background' : 'Create Background'}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'HIDE_FORM' })} disabled={isSubmitting} className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {backgrounds.length === 0 && !showForm && (
        <div className="rounded-lg border-2 border-dashed border-stone-300 p-12 text-center">
          <p className="text-stone-500">No backgrounds defined yet.</p>
        </div>
      )}

      {backgrounds.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {backgrounds.map((bg) => (
            <article key={bg.id} className="rounded-lg border border-stone-200 bg-stone-50 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold font-display text-stone-900">{bg.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  bg.type === 'studio' ? 'bg-blue-100 text-stone-950' :
                  bg.type === 'outdoor' ? 'bg-green-100 text-stone-950' :
                  bg.type === 'campaign' ? 'bg-purple-100 text-stone-950' :
                  'bg-stone-100 text-stone-950'
                }`}>
                  {bg.type}
                </span>
              </div>
              <p className="mt-2 text-sm text-stone-600 line-clamp-2">{bg.description}</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => dispatch({ type: 'SHOW_EDIT_FORM', bg })} className="text-sm text-stone-950 hover:text-stone-950">Edit</button>
                <button onClick={() => handleDelete(bg.id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
