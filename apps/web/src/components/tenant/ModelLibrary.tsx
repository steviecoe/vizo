'use client';

import { useReducer, useEffect, useState } from 'react';
import { artDirectionModelSchema, CLOTHING_SIZES } from '@vizo/shared';
import type { ArtDirectionModel } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';
import { Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────

type PageStatus = 'loading' | 'idle' | 'creating' | 'editing' | 'deleting' | 'error';

interface LibraryState {
  status: PageStatus;
  models: (ArtDirectionModel & { id: string })[];
  editingModel: (ArtDirectionModel & { id: string }) | null;
  showForm: boolean;
  formData: ModelFormData;
  fieldErrors: Record<string, string[] | undefined>;
  serverError: string | null;
}

interface ModelFormData {
  name: string;
  gender: 'male' | 'female' | 'non-binary';
  skinColour: string;
  hairColour: string;
  height: string;
  clothingSize: number;
  age: string;
}

type LibraryAction =
  | { type: 'SET_LOADED'; models: (ArtDirectionModel & { id: string })[] }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SHOW_CREATE_FORM' }
  | { type: 'SHOW_EDIT_FORM'; model: ArtDirectionModel & { id: string } }
  | { type: 'HIDE_FORM' }
  | { type: 'SET_FORM_FIELD'; field: keyof ModelFormData; value: string | number }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string[] | undefined> }
  | { type: 'SET_STATUS'; status: PageStatus }
  | { type: 'MODEL_CREATED'; model: ArtDirectionModel & { id: string } }
  | { type: 'MODEL_UPDATED'; model: ArtDirectionModel & { id: string } }
  | { type: 'MODEL_DELETED'; id: string };

const emptyForm: ModelFormData = {
  name: '',
  gender: 'female',
  skinColour: '',
  hairColour: '',
  height: '',
  clothingSize: 12,
  age: '',
};

const initialState: LibraryState = {
  status: 'loading',
  models: [],
  editingModel: null,
  showForm: false,
  formData: { ...emptyForm },
  fieldErrors: {},
  serverError: null,
};

function reducer(state: LibraryState, action: LibraryAction): LibraryState {
  switch (action.type) {
    case 'SET_LOADED':
      return { ...state, status: 'idle', models: action.models };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    case 'SHOW_CREATE_FORM':
      return { ...state, showForm: true, editingModel: null, formData: { ...emptyForm }, fieldErrors: {}, serverError: null };
    case 'SHOW_EDIT_FORM':
      return {
        ...state,
        showForm: true,
        editingModel: action.model,
        formData: {
          name: action.model.name,
          gender: action.model.gender,
          skinColour: action.model.skinColour,
          hairColour: action.model.hairColour,
          height: action.model.height,
          clothingSize: action.model.clothingSize,
          age: action.model.age,
        },
        fieldErrors: {},
        serverError: null,
      };
    case 'HIDE_FORM':
      return { ...state, showForm: false, editingModel: null, formData: { ...emptyForm }, fieldErrors: {}, serverError: null, status: 'idle' };
    case 'SET_FORM_FIELD':
      return { ...state, formData: { ...state.formData, [action.field]: action.value }, fieldErrors: { ...state.fieldErrors, [action.field]: undefined }, serverError: null };
    case 'SET_FIELD_ERRORS':
      return { ...state, status: 'idle', fieldErrors: action.errors };
    case 'SET_STATUS':
      return { ...state, status: action.status, serverError: null };
    case 'MODEL_CREATED':
      return { ...state, status: 'idle', showForm: false, models: [action.model, ...state.models], formData: { ...emptyForm } };
    case 'MODEL_UPDATED':
      return {
        ...state,
        status: 'idle',
        showForm: false,
        editingModel: null,
        models: state.models.map((m) => (m.id === action.model.id ? action.model : m)),
      };
    case 'MODEL_DELETED':
      return { ...state, status: 'idle', models: state.models.filter((m) => m.id !== action.id) };
    default:
      return state;
  }
}

// ─── Placeholder model data ────────────────────────────────

const PLACEHOLDER_MODELS = [
  { id: 'ph-1', name: 'Suki W.', gender: 'female', img: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&q=80' },
  { id: 'ph-2', name: 'Julian R.', gender: 'male', img: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=80' },
  { id: 'ph-3', name: 'Iman B.', gender: 'female', img: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&q=80' },
  { id: 'ph-4', name: 'Quinn X.', gender: 'non-binary', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80' },
  { id: 'ph-5', name: 'Aria K.', gender: 'female', img: 'https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=300&q=80' },
  { id: 'ph-6', name: 'Nia T.', gender: 'female', img: 'https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?w=300&q=80' },
  { id: 'ph-7', name: 'Mateo L.', gender: 'male', img: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&q=80' },
  { id: 'ph-8', name: 'Elena V.', gender: 'female', img: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=300&q=80' },
];

// Skin tones for create form
const SKIN_TONES = [
  { label: 'Fair', color: '#F5DEB3' },
  { label: 'Light', color: '#DEB887' },
  { label: 'Medium', color: '#C8A882' },
  { label: 'Tan', color: '#A0785A' },
  { label: 'Deep', color: '#7B4F3A' },
  { label: 'Dark', color: '#4A2C1A' },
];

const HAIR_COLOR_OPTIONS = ['Black', 'Brown', 'Blonde', 'Auburn', 'Red', 'Grey', 'White'];
const CLOTHING_SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// ─── Component ────────────────────────────────────────────

export function ModelLibrary() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, models, showForm, editingModel, formData, fieldErrors, serverError } = state;
  const isSubmitting = status === 'creating' || status === 'editing';

  // Tab state
  const [activeTab, setActiveTab] = useState<'saved' | 'create'>('saved');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  // Create form UI state
  const [selectedSkinTones, setSelectedSkinTones] = useState<string[]>([]);
  const [selectedHairColors, setSelectedHairColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await callFunction<{ models: (ArtDirectionModel & { id: string })[] }>('listModels');
        dispatch({ type: 'SET_LOADED', models: data.models });
      } catch (err: unknown) {
        dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Failed to load models' });
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = artDirectionModelSchema.safeParse(formData);
    if (!parsed.success) {
      dispatch({ type: 'SET_FIELD_ERRORS', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    if (editingModel) {
      dispatch({ type: 'SET_STATUS', status: 'editing' });
      try {
        await callFunction('updateModel', { id: editingModel.id, ...parsed.data });
        dispatch({ type: 'MODEL_UPDATED', model: { ...editingModel, ...parsed.data } });
      } catch (err: unknown) {
        dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Update failed' });
      }
    } else {
      dispatch({ type: 'SET_STATUS', status: 'creating' });
      try {
        const result = await callFunction<{ id: string }>('createModel', parsed.data);
        const newModel = {
          ...parsed.data,
          id: result.id,
          referenceImageUrl: null,
          generatedAt: null,
          createdAt: new Date().toISOString(),
          createdBy: '',
        } as ArtDirectionModel & { id: string };
        dispatch({ type: 'MODEL_CREATED', model: newModel });
        setActiveTab('saved');
      } catch (err: unknown) {
        dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Create failed' });
      }
    }
  }

  async function handleDelete(id: string) {
    dispatch({ type: 'SET_STATUS', status: 'deleting' });
    try {
      await callFunction('deleteModel', { id });
      dispatch({ type: 'MODEL_DELETED', id });
    } catch (err: unknown) {
      dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Delete failed' });
    }
  }

  function toggleSelect(id: string) {
    setSelectedModelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSkinTone(label: string) {
    setSelectedSkinTones((prev) => prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]);
  }
  function toggleHairColor(color: string) {
    setSelectedHairColors((prev) => prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]);
  }
  function toggleSize(size: string) {
    setSelectedSizes((prev) => prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]);
  }

  // Combined: real models + placeholders (placeholder cards shown when no real model image)
  const displayModels = models.length > 0 ? models : [];

  if (status === 'loading') {
    return (
      <>
        <header className="flex h-20 shrink-0 items-center border-b border-stone-200 bg-stone-50 px-8">
          <div className="h-7 w-48 animate-pulse rounded bg-stone-200" />
        </header>
        <div className="flex-1 overflow-y-auto bg-stone-100 p-6">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
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
          <h1 className="text-2xl font-bold font-display text-stone-900">Models</h1>
          <p className="mt-0.5 text-sm text-stone-500">Manage and create your custom fashion models</p>
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
                Saved Models
              </button>
              <button
                onClick={() => { setActiveTab('create'); dispatch({ type: 'SHOW_CREATE_FORM' }); }}
                className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === 'create'
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-400 hover:text-stone-700'
                }`}
              >
                Create Model
              </button>
            </div>

            <div className="p-6">
              {/* Saved Models Tab */}
              {activeTab === 'saved' && (
                <>
                  {/* Placeholder grid (shown when no real models or alongside real models) */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {/* Real models */}
                    {displayModels.map((model) => {
                      const isSelected = selectedModelIds.includes(model.id);
                      return (
                        <div
                          key={model.id}
                          className="group relative cursor-pointer"
                          onClick={() => toggleSelect(model.id)}
                        >
                          <div className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                            isSelected ? 'border-stone-900' : 'border-transparent hover:border-stone-300'
                          }`}>
                            <div className="aspect-[3/4] bg-stone-100">
                              {model.referenceImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={model.referenceImageUrl} alt={model.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center bg-stone-100 text-stone-300">
                                  <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {/* Hover / selected overlay */}
                            {isSelected && (
                              <div className="absolute inset-0 bg-stone-900/20 flex items-start justify-end p-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              </div>
                            )}
                            {!isSelected && (
                              <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/10 transition-colors flex items-start justify-end p-2 opacity-0 group-hover:opacity-100">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white/20" />
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-stone-900">{model.name}</p>
                              <p className="text-xs text-stone-400 capitalize">{model.gender}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SHOW_EDIT_FORM', model }); setActiveTab('create'); }}
                                className="text-xs text-stone-500 hover:text-stone-900"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(model.id); }}
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                Del
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Placeholder models */}
                    {PLACEHOLDER_MODELS.map((placeholder) => {
                      const isSelected = selectedModelIds.includes(placeholder.id);
                      return (
                        <div
                          key={placeholder.id}
                          className="group relative cursor-pointer"
                          onClick={() => toggleSelect(placeholder.id)}
                        >
                          <div className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                            isSelected ? 'border-stone-900' : 'border-transparent hover:border-stone-300'
                          }`}>
                            <div className="aspect-[3/4] bg-stone-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={placeholder.img}
                                alt={placeholder.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            {isSelected && (
                              <div className="absolute inset-0 bg-stone-900/20 flex items-start justify-end p-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              </div>
                            )}
                            {!isSelected && (
                              <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/10 transition-colors flex items-start justify-end p-2 opacity-0 group-hover:opacity-100">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white/20" />
                              </div>
                            )}
                          </div>
                          <div className="mt-2">
                            <p className="text-sm font-semibold text-stone-900">{placeholder.name}</p>
                            <p className="text-xs text-stone-400 capitalize">{placeholder.gender}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Use in studio CTA */}
                  {selectedModelIds.length > 0 && (
                    <div className="mt-6 flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-5 py-4">
                      <span className="text-sm font-medium text-stone-700">
                        {selectedModelIds.length} model{selectedModelIds.length > 1 ? 's' : ''} selected
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedModelIds([])}
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

              {/* Create Model Tab */}
              {activeTab === 'create' && (
                <form onSubmit={handleSubmit}>
                  {showForm && (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {/* Name */}
                      <div className="sm:col-span-2">
                        <label htmlFor="model-name" className="block text-sm font-medium text-stone-700">Model Name</label>
                        <input
                          id="model-name"
                          type="text"
                          value={formData.name}
                          onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'name', value: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                          placeholder="e.g. Suki W."
                        />
                        {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name[0]}</p>}
                      </div>

                      {/* Gender */}
                      <div>
                        <label htmlFor="model-gender" className="block text-sm font-medium text-stone-700">Gender</label>
                        <select
                          id="model-gender"
                          value={formData.gender}
                          onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'gender', value: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                        >
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="non-binary">Non-binary</option>
                        </select>
                      </div>

                      {/* Height */}
                      <div>
                        <label htmlFor="model-height" className="block text-sm font-medium text-stone-700">Height</label>
                        <input
                          id="model-height"
                          type="text"
                          value={formData.height}
                          onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'height', value: e.target.value })}
                          placeholder="e.g. 175cm"
                          className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                        />
                        {fieldErrors.height && <p className="mt-1 text-xs text-red-600">{fieldErrors.height[0]}</p>}
                      </div>

                      {/* Age */}
                      <div>
                        <label htmlFor="model-age" className="block text-sm font-medium text-stone-700">Age Range</label>
                        <input
                          id="model-age"
                          type="text"
                          value={formData.age}
                          onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'age', value: e.target.value })}
                          placeholder="e.g. 25-30"
                          className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                        />
                        {fieldErrors.age && <p className="mt-1 text-xs text-red-600">{fieldErrors.age[0]}</p>}
                      </div>

                      {/* Clothing Size */}
                      <div>
                        <label htmlFor="model-size" className="block text-sm font-medium text-stone-700">Clothing Size (UK)</label>
                        <select
                          id="model-size"
                          value={formData.clothingSize}
                          onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'clothingSize', value: parseInt(e.target.value, 10) })}
                          className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                        >
                          {CLOTHING_SIZES.map((size) => (<option key={size} value={size}>UK {size}</option>))}
                        </select>
                      </div>

                      {/* Skin Tones */}
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-stone-700 mb-2">Skin Tone</label>
                        <div className="flex gap-3 flex-wrap">
                          {SKIN_TONES.map((tone) => (
                            <button
                              key={tone.label}
                              type="button"
                              onClick={() => {
                                toggleSkinTone(tone.label);
                                dispatch({ type: 'SET_FORM_FIELD', field: 'skinColour', value: tone.label });
                              }}
                              title={tone.label}
                              className={`h-9 w-9 rounded-full border-2 transition-all ${
                                selectedSkinTones.includes(tone.label) || formData.skinColour === tone.label
                                  ? 'border-stone-900 scale-110'
                                  : 'border-transparent hover:border-stone-400'
                              }`}
                              style={{ backgroundColor: tone.color }}
                            />
                          ))}
                          <input
                            type="text"
                            value={formData.skinColour}
                            onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'skinColour', value: e.target.value })}
                            placeholder="or type e.g. medium"
                            className="flex-1 min-w-[140px] rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:border-stone-950 focus:ring-stone-950"
                          />
                        </div>
                        {fieldErrors.skinColour && <p className="mt-1 text-xs text-red-600">{fieldErrors.skinColour[0]}</p>}
                      </div>

                      {/* Hair Color */}
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-stone-700 mb-2">Hair Color</label>
                        <div className="flex gap-2 flex-wrap">
                          {HAIR_COLOR_OPTIONS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                toggleHairColor(color);
                                dispatch({ type: 'SET_FORM_FIELD', field: 'hairColour', value: color });
                              }}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                                selectedHairColors.includes(color) || formData.hairColour === color
                                  ? 'bg-stone-900 text-white border-stone-900'
                                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                              }`}
                            >
                              {color}
                            </button>
                          ))}
                          <input
                            type="text"
                            value={formData.hairColour}
                            onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'hairColour', value: e.target.value })}
                            placeholder="or type e.g. brown"
                            className="flex-1 min-w-[140px] rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:border-stone-950 focus:ring-stone-950"
                          />
                        </div>
                        {fieldErrors.hairColour && <p className="mt-1 text-xs text-red-600">{fieldErrors.hairColour[0]}</p>}
                      </div>

                      {/* Clothing Size chips */}
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-stone-700 mb-2">Clothing Size (Quick Select)</label>
                        <div className="flex gap-2 flex-wrap">
                          {CLOTHING_SIZE_LABELS.map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => toggleSize(size)}
                              className={`h-9 w-9 rounded-lg text-xs font-bold border-2 transition-all ${
                                selectedSizes.includes(size)
                                  ? 'bg-stone-900 text-white border-stone-900'
                                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-full bg-stone-950 px-6 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Generating...' : editingModel ? 'Update Model' : 'Generate Model'}
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
