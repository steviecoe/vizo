'use client';

import { useReducer, useEffect, useState } from 'react';
import { artDirectionBackgroundSchema } from '@vizo/shared';
import type { ArtDirectionBackground } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';
import { Check, Upload } from 'lucide-react';

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

// ─── Placeholder environments ─────────────────────────────

const PLACEHOLDER_ENVIRONMENTS = [
  {
    id: 'env-ph-1',
    name: 'Minimalist Luxury',
    img: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=400&q=80',
  },
  {
    id: 'env-ph-2',
    name: 'Architectural',
    img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=80',
  },
  {
    id: 'env-ph-3',
    name: 'Exotic Beach',
    img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  },
  {
    id: 'env-ph-4',
    name: 'Concrete Museum',
    img: 'https://images.unsplash.com/photo-1554136083-2b89e74e7826?w=400&q=80',
  },
];

// ─── Component ────────────────────────────────────────────

export function BackgroundLibrary() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, backgrounds, showForm, editingBg, formData, fieldErrors, serverError } = state;
  const isSubmitting = status === 'creating' || status === 'editing';

  const [activeTab, setActiveTab] = useState<'saved' | 'create'>('saved');
  const [selectedBgIds, setSelectedBgIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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
        setActiveTab('saved');
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
        setActiveTab('saved');
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

  function toggleSelect(id: string) {
    setSelectedBgIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (status === 'loading') {
    return (
      <>
        <header className="flex h-20 shrink-0 items-center border-b border-stone-200 bg-stone-50 px-8">
          <div className="h-7 w-48 animate-pulse rounded bg-stone-200" />
        </header>
        <div className="flex-1 overflow-y-auto bg-stone-100 p-6">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-stone-200" />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50 px-8">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-900">Environments</h1>
          <p className="mt-0.5 text-sm text-stone-500">Manage and create background settings for your shoots</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-stone-100 p-6">
        <div className="mx-auto max-w-6xl">

          {serverError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4" role="alert">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {/* Main Card */}
          <div className="rounded-xl border border-stone-200 bg-white">
            {/* Tabs */}
            <div className="flex border-b border-stone-200 px-6 pt-4">
              <button
                onClick={() => setActiveTab('saved')}
                className={`mr-6 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === 'saved'
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-400 hover:text-stone-700'
                }`}
              >
                Saved Environments
              </button>
              <button
                onClick={() => { setActiveTab('create'); dispatch({ type: 'SHOW_CREATE_FORM' }); }}
                className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === 'create'
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-400 hover:text-stone-700'
                }`}
              >
                Create Environment
              </button>
            </div>

            <div className="p-6">
              {/* Saved Environments Tab */}
              {activeTab === 'saved' && (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {/* Real backgrounds */}
                    {backgrounds.map((bg) => {
                      const isSelected = selectedBgIds.includes(bg.id);
                      return (
                        <div
                          key={bg.id}
                          className="group relative cursor-pointer"
                          onClick={() => toggleSelect(bg.id)}
                        >
                          <div className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                            isSelected ? 'border-stone-900' : 'border-transparent hover:border-stone-300'
                          }`}>
                            <div className="aspect-[3/4] bg-stone-100">
                              {bg.referenceImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={bg.referenceImageUrl} alt={bg.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center bg-stone-100 text-stone-300">
                                  <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {/* Gradient overlay with name */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-3">
                              <p className="text-sm font-semibold text-white">{bg.name}</p>
                            </div>
                            {/* Checkmark */}
                            {isSelected && (
                              <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-stone-900">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                            {!isSelected && (
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white/20" />
                              </div>
                            )}
                          </div>
                          {/* Actions on hover */}
                          <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-stone-400 capitalize">{bg.type}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SHOW_EDIT_FORM', bg }); setActiveTab('create'); }}
                                className="text-xs text-stone-500 hover:text-stone-900"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(bg.id); }}
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Placeholder environments */}
                    {PLACEHOLDER_ENVIRONMENTS.map((env) => {
                      const isSelected = selectedBgIds.includes(env.id);
                      return (
                        <div
                          key={env.id}
                          className="group relative cursor-pointer"
                          onClick={() => toggleSelect(env.id)}
                        >
                          <div className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                            isSelected ? 'border-stone-900' : 'border-transparent hover:border-stone-300'
                          }`}>
                            <div className="aspect-[3/4] bg-stone-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={env.img}
                                alt={env.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-3">
                              <p className="text-sm font-semibold text-white">{env.name}</p>
                            </div>
                            {isSelected && (
                              <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-stone-900">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                            {!isSelected && (
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white/20" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Use in studio CTA */}
                  {selectedBgIds.length > 0 && (
                    <div className="mt-6 flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-5 py-4">
                      <span className="text-sm font-medium text-stone-700">
                        {selectedBgIds.length} environment{selectedBgIds.length > 1 ? 's' : ''} selected
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedBgIds([])}
                          className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
                        >
                          Clear
                        </button>
                        <a
                          href="/tenant/generate/quick"
                          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
                        >
                          Use in Studio
                        </a>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Create Environment Tab */}
              {activeTab === 'create' && showForm && (
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Left — prompt/form */}
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="bg-name" className="block text-sm font-medium text-stone-700">Name</label>
                        <input
                          id="bg-name"
                          type="text"
                          value={formData.name}
                          onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'name', value: e.target.value })}
                          placeholder="e.g. Minimalist Luxury Studio"
                          className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                        />
                        {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name[0]}</p>}
                      </div>

                      <div>
                        <label htmlFor="bg-type" className="block text-sm font-medium text-stone-700">Type</label>
                        <select
                          id="bg-type"
                          value={formData.type}
                          onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'type', value: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                        >
                          <option value="studio">Studio</option>
                          <option value="outdoor">Outdoor</option>
                          <option value="campaign">Campaign</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="bg-description" className="block text-sm font-medium text-stone-700">
                          Prompt / Description
                        </label>
                        <textarea
                          id="bg-description"
                          rows={6}
                          value={formData.description}
                          onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'description', value: e.target.value })}
                          placeholder="Describe the background environment in detail — lighting, mood, architecture, textures..."
                          className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                        />
                        {fieldErrors.description && <p className="mt-1 text-xs text-red-600">{fieldErrors.description[0]}</p>}
                      </div>
                    </div>

                    {/* Right — drag/drop upload */}
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">Reference Image (optional)</label>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
                        className={`flex h-[200px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors ${
                          isDragging ? 'border-stone-500 bg-stone-100' : 'border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        <Upload className="h-8 w-8 text-stone-300" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-stone-500">Drag &amp; drop an image</p>
                          <p className="text-xs text-stone-400">or <span className="text-stone-700 underline cursor-pointer">browse files</span></p>
                        </div>
                        <p className="text-[10px] text-stone-400">PNG, JPG up to 10MB</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-full bg-stone-950 px-6 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Generating...' : editingBg ? 'Update Environment' : 'Generate Environment'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { dispatch({ type: 'HIDE_FORM' }); setActiveTab('saved'); }}
                      disabled={isSubmitting}
                      className="rounded-full border border-stone-300 px-6 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
