'use client';

import { useReducer, useEffect, useRef, useState } from 'react';
import { RESOLUTIONS, ASPECT_RATIOS, MAX_VARIANTS_PER_JOB } from '@vizo/shared';
import type { ArtDirectionModel, ArtDirectionBackground, ShopifyProduct } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';
import { Upload, ChevronDown, Plus, Trash2, Moon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────

interface WizardState {
  models: (ArtDirectionModel & { id: string })[];
  backgrounds: (ArtDirectionBackground & { id: string })[];
  products: (ShopifyProduct & { id: string })[];
  assetsLoading: boolean;
  selectedModelIds: string[];
  selectedBackgroundIds: string[];
  selectedProductIds: string[];
  itemImageUrls: string[];
  resolution: '1k' | '2k';
  aspectRatio: '1:1' | '4:5' | '16:9';
  variantCount: number;
  brief: string;
  generating: boolean;
  result: GenerateResult | null;
  serverError: string | null;
}

interface GenerateResult {
  jobId: string;
  status: string;
  completedImages: number;
  failedImages: number;
  creditsCost: number;
  creditsRefunded: number;
}

type WizardAction =
  | { type: 'ASSETS_LOADED'; models: (ArtDirectionModel & { id: string })[]; backgrounds: (ArtDirectionBackground & { id: string })[]; products: (ShopifyProduct & { id: string })[] }
  | { type: 'TOGGLE_MODEL'; id: string }
  | { type: 'TOGGLE_BACKGROUND'; id: string }
  | { type: 'TOGGLE_PRODUCT'; id: string }
  | { type: 'ADD_IMAGE_URL'; url: string }
  | { type: 'REMOVE_IMAGE_URL'; index: number }
  | { type: 'SET_CONFIG'; field: 'resolution' | 'aspectRatio' | 'brief'; value: string }
  | { type: 'SET_VARIANT_COUNT'; count: number }
  | { type: 'SET_GENERATING' }
  | { type: 'SET_COMPLETE'; result: GenerateResult }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' };

const initialState: WizardState = {
  models: [],
  backgrounds: [],
  products: [],
  assetsLoading: true,
  selectedModelIds: [],
  selectedBackgroundIds: [],
  selectedProductIds: [],
  itemImageUrls: [],
  resolution: '1k',
  aspectRatio: '4:5',
  variantCount: 1,
  brief: '',
  generating: false,
  result: null,
  serverError: null,
};

function toggleInArray(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'ASSETS_LOADED':
      return { ...state, assetsLoading: false, models: action.models, backgrounds: action.backgrounds, products: action.products };
    case 'TOGGLE_MODEL':
      return { ...state, selectedModelIds: toggleInArray(state.selectedModelIds, action.id) };
    case 'TOGGLE_BACKGROUND':
      return { ...state, selectedBackgroundIds: toggleInArray(state.selectedBackgroundIds, action.id) };
    case 'TOGGLE_PRODUCT':
      return { ...state, selectedProductIds: toggleInArray(state.selectedProductIds, action.id) };
    case 'ADD_IMAGE_URL':
      return { ...state, itemImageUrls: [...state.itemImageUrls, action.url] };
    case 'REMOVE_IMAGE_URL':
      return { ...state, itemImageUrls: state.itemImageUrls.filter((_, i) => i !== action.index) };
    case 'SET_CONFIG':
      return { ...state, [action.field]: action.value };
    case 'SET_VARIANT_COUNT':
      return { ...state, variantCount: action.count };
    case 'SET_GENERATING':
      return { ...state, generating: true, serverError: null, result: null };
    case 'SET_COMPLETE':
      return { ...state, generating: false, result: action.result };
    case 'SET_ERROR':
      return { ...state, generating: false, serverError: action.error };
    case 'RESET':
      return { ...initialState, assetsLoading: false, models: state.models, backgrounds: state.backgrounds, products: state.products };
    default:
      return state;
  }
}

function getCreditCost(resolution: string): number {
  return resolution === '2k' ? 10 : 5;
}

// ─── Camera angles ────────────────────────────────────────
const CAMERA_ANGLES = ['3/4', 'Front', 'Detail', 'Back', 'Side'];

// ─── Skin tones ───────────────────────────────────────────
const SKIN_TONES = [
  { label: 'Fair', color: '#F5DEB3' },
  { label: 'Light', color: '#DEB887' },
  { label: 'Medium', color: '#C8A882' },
  { label: 'Tan', color: '#A0785A' },
  { label: 'Deep', color: '#7B4F3A' },
  { label: 'Dark', color: '#4A2C1A' },
];

const HAIR_COLORS = ['Black', 'Brown', 'Blonde', 'Auburn', 'Red', 'Grey', 'White'];
const CLOTHING_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// ─── Component ────────────────────────────────────────────

export function QuickGenWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Local UI state for tabs and sections
  const [photoshootTab, setPhotoshootTab] = useState<'new' | 'existing'>('new');
  const [newPhotoshootName, setNewPhotoshootName] = useState('');
  const [selectedPhotoshoot, setSelectedPhotoshoot] = useState('');
  const [productSourceTab, setProductSourceTab] = useState<'upload' | 'shopify'>('upload');
  const [uploadSubTab, setUploadSubTab] = useState<'existing' | 'new-folder'>('existing');
  const [modelTab, setModelTab] = useState<'saved' | 'create'>('saved');
  const [selectedAngles, setSelectedAngles] = useState<string[]>(['Front']);
  const [selectedSkinTones, setSelectedSkinTones] = useState<string[]>([]);
  const [selectedHairColors, setSelectedHairColors] = useState<string[]>([]);
  const [selectedClothingSizes, setSelectedClothingSizes] = useState<string[]>([]);
  const [createModelGender, setCreateModelGender] = useState<'female' | 'male' | 'non-binary'>('female');
  const [skuFolders, setSkuFolders] = useState([{ sku: '', files: [] as File[] }]);
  const [overnightMode, setOvernightMode] = useState(false);

  useEffect(() => {
    async function loadAssets() {
      try {
        const [modelsRes, bgRes, productsRes] = await Promise.all([
          callFunction<{ models: (ArtDirectionModel & { id: string })[] }>('listModels'),
          callFunction<{ backgrounds: (ArtDirectionBackground & { id: string })[] }>('listBackgrounds'),
          callFunction<{ products: (ShopifyProduct & { id: string })[] }>('listProducts').catch(() => ({ products: [] })),
        ]);
        dispatch({ type: 'ASSETS_LOADED', models: modelsRes.models, backgrounds: bgRes.backgrounds, products: productsRes.products });
      } catch {
        dispatch({ type: 'ASSETS_LOADED', models: [], backgrounds: [], products: [] });
      }
    }
    loadAssets();
  }, []);

  const hasContent = state.selectedProductIds.length > 0 || state.itemImageUrls.length > 0;
  const creditCost = getCreditCost(state.resolution) * state.variantCount;

  async function handleGenerate() {
    dispatch({ type: 'SET_GENERATING' });
    try {
      const result = await callFunction<GenerateResult>('quickGenerate', {
        params: {
          resolution: state.resolution,
          aspectRatio: state.aspectRatio,
          variantCount: state.variantCount,
          brief: state.brief,
          modelIds: state.selectedModelIds,
          backgroundIds: state.selectedBackgroundIds,
          productIds: state.selectedProductIds,
          itemImageUrls: state.itemImageUrls,
        },
      });
      dispatch({ type: 'SET_COMPLETE', result });
    } catch (err: unknown) {
      dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Generation failed' });
    }
  }

  function handleAddUrl() {
    const input = urlInputRef.current;
    if (input?.value) {
      dispatch({ type: 'ADD_IMAGE_URL', url: input.value });
      input.value = '';
    }
  }

  function toggleAngle(angle: string) {
    setSelectedAngles((prev) =>
      prev.includes(angle) ? prev.filter((a) => a !== angle) : [...prev, angle]
    );
  }

  function toggleSkinTone(label: string) {
    setSelectedSkinTones((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  }

  function toggleHairColor(color: string) {
    setSelectedHairColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  }

  function toggleClothingSize(size: string) {
    setSelectedClothingSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  }

  function addSkuFolder() {
    setSkuFolders((prev) => [...prev, { sku: '', files: [] }]);
  }

  function updateSkuFolder(index: number, sku: string) {
    setSkuFolders((prev) => prev.map((f, i) => (i === index ? { ...f, sku } : f)));
  }

  function removeSkuFolder(index: number) {
    setSkuFolders((prev) => prev.filter((_, i) => i !== index));
  }

  if (state.assetsLoading) {
    return (
      <>
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50 px-8">
          <div className="h-7 w-48 animate-pulse rounded bg-stone-200" />
        </header>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 animate-pulse bg-stone-100 p-8">
            <div className="space-y-8">
              <div className="h-40 rounded-xl bg-stone-200" />
              <div className="h-40 rounded-xl bg-stone-200" />
              <div className="h-32 rounded-xl bg-stone-200" />
            </div>
          </div>
          <div className="w-[360px] animate-pulse bg-stone-50 p-6">
            <div className="h-64 rounded-xl bg-stone-200" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50 px-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold font-display text-stone-900">AI Generation Studio</h1>
          <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-500">
            v2.4 Pro
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center text-sm text-stone-500" title="Credits per batch">
            <svg className="mr-1.5 h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.464 15.657a1 1 0 010-1.414l.707-.707a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414 0zM6.464 14.95l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414z" />
            </svg>
            <span className="font-medium">{creditCost} Credits per batch</span>
          </div>
          <button
            onClick={handleGenerate}
            disabled={!hasContent || state.generating}
            className="flex items-center gap-2 rounded-full bg-stone-900 px-8 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-black hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.generating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating...
              </>
            ) : (
              <>
                Generate
                <span className="text-xs opacity-40">|</span>
                <span className="text-xs">Batch ({state.variantCount})</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Studio Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Column — Form */}
        <section className="flex-1 overflow-y-auto border-r border-stone-200 bg-stone-50 p-8">
          <div className="mx-auto max-w-2xl space-y-8">

            {/* Config notice */}
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs text-amber-800">
                Image generation requires a Gemini API key configured for this tenant. Without it, generation requests will fail.
              </p>
            </div>

            {/* Section 1 — Photoshoot Selection */}
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="mb-4 text-xs font-bold font-display uppercase tracking-widest text-stone-400">
                1. Photoshoot Selection
              </h3>
              {/* Tabs */}
              <div className="mb-4 flex gap-1 rounded-lg bg-stone-100 p-1">
                <button
                  onClick={() => setPhotoshootTab('new')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    photoshootTab === 'new' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Create New
                </button>
                <button
                  onClick={() => setPhotoshootTab('existing')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    photoshootTab === 'existing' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Add to Existing
                </button>
              </div>
              {photoshootTab === 'new' ? (
                <input
                  type="text"
                  value={newPhotoshootName}
                  onChange={(e) => setNewPhotoshootName(e.target.value)}
                  placeholder="e.g. Summer Collection 2026"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                />
              ) : (
                <div className="relative">
                  <select
                    value={selectedPhotoshoot}
                    onChange={(e) => setSelectedPhotoshoot(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                  >
                    <option value="">Select a photoshoot...</option>
                    <option value="spring">Spring Lookbook</option>
                    <option value="basics">Basics Range</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                </div>
              )}
            </div>

            {/* Section 2 — Product Source */}
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="mb-4 text-xs font-bold font-display uppercase tracking-widest text-stone-400">
                2. Product Source
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setProductSourceTab('upload')}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                    productSourceTab === 'upload'
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200 hover:border-stone-400'
                  }`}
                >
                  <Upload className="h-5 w-5 text-stone-600" />
                  Upload Product
                </button>
                <button
                  onClick={() => setProductSourceTab('shopify')}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                    productSourceTab === 'shopify'
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200 hover:border-stone-400'
                  }`}
                >
                  <svg className="h-5 w-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Select from Shopify
                </button>
              </div>

              {productSourceTab === 'upload' && (
                <div className="mt-4">
                  {/* Sub-tabs */}
                  <div className="mb-4 flex gap-1 rounded-lg bg-stone-100 p-1">
                    <button
                      onClick={() => setUploadSubTab('existing')}
                      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        uploadSubTab === 'existing' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                      }`}
                    >
                      Existing Folder
                    </button>
                    <button
                      onClick={() => setUploadSubTab('new-folder')}
                      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        uploadSubTab === 'new-folder' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                      }`}
                    >
                      Create New Folder(s)
                    </button>
                  </div>

                  {uploadSubTab === 'existing' ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <select className="w-full appearance-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950">
                          <option value="">Select folder...</option>
                          <option value="summer">Summer Items</option>
                          <option value="basics">Basics</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      </div>
                      <div className="rounded-xl border-2 border-dashed border-stone-200 p-6 text-center">
                        <Upload className="mx-auto h-6 w-6 text-stone-300" />
                        <p className="mt-2 text-sm text-stone-500">Drag &amp; drop files here or <span className="text-stone-900 underline cursor-pointer">browse</span></p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {skuFolders.map((folder, index) => (
                        <div key={index} className="rounded-xl border border-stone-200 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <input
                              type="text"
                              value={folder.sku}
                              onChange={(e) => updateSkuFolder(index, e.target.value)}
                              placeholder="SKU / Folder name"
                              className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                            />
                            {skuFolders.length > 1 && (
                              <button
                                onClick={() => removeSkuFolder(index)}
                                className="text-stone-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <div className="rounded-xl border-2 border-dashed border-stone-200 p-4 text-center">
                            <Upload className="mx-auto h-5 w-5 text-stone-300" />
                            <p className="mt-1 text-xs text-stone-400">Drop product images here</p>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={addSkuFolder}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 py-2.5 text-sm font-medium text-stone-500 hover:border-stone-500 hover:text-stone-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Add Another Folder
                      </button>
                    </div>
                  )}
                </div>
              )}

              {productSourceTab === 'shopify' && (
                <div className="mt-4">
                  {state.products.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {state.products.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => dispatch({ type: 'TOGGLE_PRODUCT', id: p.id })}
                          className={`rounded-lg border p-3 text-left text-sm transition-all ${
                            state.selectedProductIds.includes(p.id)
                              ? 'border-stone-900 bg-stone-50'
                              : 'border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          <span className="font-medium text-stone-800">{p.title}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center">
                      <p className="text-sm text-stone-400">No Shopify products synced yet.</p>
                    </div>
                  )}

                  {/* Or add image URLs */}
                  <div className="mt-4 border-t border-stone-100 pt-4">
                    <label className="block text-xs font-semibold text-stone-600">Or add image URLs directly</label>
                    <div className="mt-2 flex gap-2">
                      <input
                        ref={urlInputRef}
                        type="url"
                        placeholder="https://..."
                        className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); }
                        }}
                      />
                      <button
                        onClick={handleAddUrl}
                        className="rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200"
                      >
                        Add
                      </button>
                    </div>
                    {state.itemImageUrls.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {state.itemImageUrls.map((url, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-stone-600">
                            <span className="truncate flex-1">{url}</span>
                            <button onClick={() => dispatch({ type: 'REMOVE_IMAGE_URL', index: i })} className="text-red-500 hover:text-red-700">&times;</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3 — Model Specifications */}
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="mb-4 text-xs font-bold font-display uppercase tracking-widest text-stone-400">
                3. Model Specifications
              </h3>
              <div className="mb-4 flex gap-1 rounded-lg bg-stone-100 p-1">
                <button
                  onClick={() => setModelTab('saved')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    modelTab === 'saved' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Saved Models
                </button>
                <button
                  onClick={() => setModelTab('create')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    modelTab === 'create' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Create Model
                </button>
              </div>

              {modelTab === 'saved' ? (
                state.models.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                    {state.models.map((m) => {
                      const selected = state.selectedModelIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => dispatch({ type: 'TOGGLE_MODEL', id: m.id })}
                          className={`shrink-0 snap-start w-28 rounded-xl border-2 p-3 text-left transition-all ${
                            selected ? 'border-stone-900 bg-stone-50' : 'border-stone-100 hover:border-stone-300'
                          }`}
                        >
                          <div className="mb-2 h-20 w-full rounded-lg bg-stone-100 overflow-hidden">
                            {m.referenceImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.referenceImageUrl} alt={m.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-stone-300 text-xs">No image</div>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-stone-800 truncate">{m.name}</p>
                          {m.gender && <p className="text-[10px] text-stone-400 capitalize">{m.gender}</p>}
                          {selected && (
                            <div className="mt-1 flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-rose-500" />
                              <span className="text-[10px] font-bold text-rose-600">Selected</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center">
                    <p className="text-sm text-stone-400">No models yet. Create one using the &quot;Create Model&quot; tab.</p>
                  </div>
                )
              ) : (
                <div className="space-y-5">
                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-2">Gender</label>
                    <div className="relative">
                      <select
                        value={createModelGender}
                        onChange={(e) => setCreateModelGender(e.target.value as 'female' | 'male' | 'non-binary')}
                        className="w-full appearance-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                      >
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="non-binary">Non-binary</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    </div>
                  </div>

                  {/* Skin Tones */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-2">Skin Tone</label>
                    <div className="flex gap-2 flex-wrap">
                      {SKIN_TONES.map((tone) => (
                        <button
                          key={tone.label}
                          onClick={() => toggleSkinTone(tone.label)}
                          title={tone.label}
                          className={`h-8 w-8 rounded-full border-2 transition-all ${
                            selectedSkinTones.includes(tone.label)
                              ? 'border-stone-900 scale-110'
                              : 'border-transparent hover:border-stone-400'
                          }`}
                          style={{ backgroundColor: tone.color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Hair Colors */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-2">Hair Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {HAIR_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => toggleHairColor(color)}
                          className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                            selectedHairColors.includes(color)
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clothing Sizes */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-2">Clothing Size</label>
                    <div className="flex gap-2 flex-wrap">
                      {CLOTHING_SIZE_OPTIONS.map((size) => (
                        <button
                          key={size}
                          onClick={() => toggleClothingSize(size)}
                          className={`h-9 w-9 rounded-lg text-xs font-bold border-2 transition-all ${
                            selectedClothingSizes.includes(size)
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
            </div>

            {/* Section 4 — Creative Direction */}
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="mb-4 text-xs font-bold font-display uppercase tracking-widest text-stone-400">
                4. Creative Direction
              </h3>

              {/* Background Environment */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-stone-600 mb-3">Background Environment</label>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                  {/* Create new card */}
                  <button className="shrink-0 snap-start flex h-24 w-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-200 text-stone-400 hover:border-stone-400 transition-colors">
                    <Plus className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Create new</span>
                  </button>
                  {state.backgrounds.map((bg) => {
                    const selected = state.selectedBackgroundIds.includes(bg.id);
                    return (
                      <button
                        key={bg.id}
                        onClick={() => dispatch({ type: 'TOGGLE_BACKGROUND', id: bg.id })}
                        className={`shrink-0 snap-start relative overflow-hidden rounded-xl border-2 transition-all ${
                          selected ? 'border-stone-900' : 'border-stone-100 hover:border-stone-300'
                        }`}
                        style={{ width: 112, height: 96 }}
                      >
                        {bg.referenceImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={bg.referenceImageUrl} alt={bg.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-stone-100">
                            <span className="text-[10px] text-stone-400">{bg.name}</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-[10px] font-semibold text-white truncate">{bg.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Camera Angles */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-stone-600 mb-2">Camera Angles</label>
                <div className="flex gap-2 flex-wrap">
                  {CAMERA_ANGLES.map((angle) => (
                    <button
                      key={angle}
                      onClick={() => toggleAngle(angle)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border-2 transition-all ${
                        selectedAngles.includes(angle)
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      {angle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Creative Brief */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-2">Creative Brief</label>
                <textarea
                  value={state.brief}
                  onChange={(e) => dispatch({ type: 'SET_CONFIG', field: 'brief', value: e.target.value })}
                  className="w-full rounded-xl border border-stone-200 p-4 text-sm focus:border-stone-950 focus:ring-stone-950"
                  placeholder="Describe the mood, lighting, or specific pose (e.g. 'Soft evening glow, high fashion editorial pose, sharp focus on fabric texture')"
                  rows={3}
                />
              </div>
            </div>

          </div>
        </section>

        {/* Right Column — Output Settings + Summary */}
        <aside className="w-[360px] shrink-0 overflow-y-auto bg-stone-50 p-6">
          <div className="space-y-4">

            {/* Output Settings */}
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-stone-400">Output Settings</h4>

              {/* Resolution */}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold text-stone-600">Resolution</label>
                <div className="relative">
                  <select
                    value={state.resolution}
                    onChange={(e) => dispatch({ type: 'SET_CONFIG', field: 'resolution', value: e.target.value })}
                    className="w-full appearance-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                  >
                    {RESOLUTIONS.map((r) => (
                      <option key={r} value={r}>{r === '1k' ? '1K — 1024px' : '2K — 2048px'}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold text-stone-600">Aspect Ratio</label>
                <div className="relative">
                  <select
                    value={state.aspectRatio}
                    onChange={(e) => dispatch({ type: 'SET_CONFIG', field: 'aspectRatio', value: e.target.value })}
                    className="w-full appearance-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                  >
                    {ASPECT_RATIOS.map((ar) => (
                      <option key={ar} value={ar}>{ar}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                </div>
              </div>

              {/* Variants */}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold text-stone-600">Variants per Product</label>
                <div className="flex gap-2">
                  {Array.from({ length: MAX_VARIANTS_PER_JOB }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => dispatch({ type: 'SET_VARIANT_COUNT', count: n })}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                        state.variantCount === n
                          ? 'border-2 border-stone-900 bg-stone-50 text-stone-900'
                          : 'border border-stone-200 bg-white text-stone-400 hover:border-stone-400'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overnight Mode */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-stone-500" />
                  <span className="text-sm font-medium text-stone-700">Overnight Mode</span>
                </div>
                <button
                  onClick={() => setOvernightMode(!overnightMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    overnightMode ? 'bg-stone-900' : 'bg-stone-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      overnightMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {overnightMode && (
                <p className="mt-2 text-xs text-stone-400">Images will be generated overnight during off-peak hours.</p>
              )}
            </div>

            {/* Generation Status */}
            {state.generating && (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-100/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-tight text-stone-500">Current Batch</span>
                  <span className="flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-stone-950">
                    <span className="mr-1.5 h-1 w-1 animate-pulse rounded-full bg-amber-600" />
                    Processing
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-px bg-stone-100">
                  {Array.from({ length: state.variantCount }).map((_, i) => (
                    <div key={i} className="flex aspect-[3/4] items-center justify-center bg-stone-200">
                      <svg className="h-8 w-8 animate-pulse text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.result && (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-100/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-tight text-stone-500">
                    Batch #{state.result.jobId.slice(0, 8)}
                  </span>
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-stone-950">Complete</span>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Images Generated</span>
                    <span className="font-semibold text-stone-900">{state.result.completedImages}</span>
                  </div>
                  {state.result.failedImages > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-500">Failed</span>
                      <span className="font-semibold text-red-700">{state.result.failedImages}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Credits Used</span>
                    <span className="font-semibold text-stone-900">{state.result.creditsCost - state.result.creditsRefunded}</span>
                  </div>
                </div>
                <div className="border-t border-stone-100 p-3">
                  <button
                    onClick={() => dispatch({ type: 'RESET' })}
                    className="w-full rounded-lg bg-stone-900 py-2 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-black"
                  >
                    Generate More
                  </button>
                </div>
              </div>
            )}

            {state.serverError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">Generation Failed</p>
                <p className="mt-1 text-xs text-red-700">{state.serverError}</p>
                <p className="mt-2 text-[10px] text-red-500">Credits for failed images are automatically refunded.</p>
                <button
                  onClick={() => dispatch({ type: 'RESET' })}
                  className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Summary card */}
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-stone-400">Summary</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-stone-500">Models</dt>
                  <dd className="font-medium text-stone-900">{state.selectedModelIds.length || 'None'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Backgrounds</dt>
                  <dd className="font-medium text-stone-900">{state.selectedBackgroundIds.length || 'Default'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Products / Images</dt>
                  <dd className="font-medium text-stone-900">{state.selectedProductIds.length + state.itemImageUrls.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Resolution</dt>
                  <dd className="font-medium text-stone-900">{state.resolution === '1k' ? '1024px' : '2048px'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Aspect Ratio</dt>
                  <dd className="font-medium text-stone-900">{state.aspectRatio}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Overnight Mode</dt>
                  <dd className="font-medium text-stone-900">{overnightMode ? 'On' : 'Off'}</dd>
                </div>
                <div className="flex justify-between border-t border-stone-100 pt-2">
                  <dt className="text-stone-500 font-semibold">Per Image</dt>
                  <dd className="font-bold text-stone-900">{getCreditCost(state.resolution)} credits</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold text-stone-700">Estimated Total</dt>
                  <dd className="font-bold text-stone-900">{creditCost} credits</dd>
                </div>
              </dl>
              <button
                onClick={handleGenerate}
                disabled={!hasContent || state.generating}
                className="mt-4 w-full rounded-full bg-stone-900 py-2.5 text-sm font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.generating ? 'Generating...' : 'Start Generation'}
              </button>
              {!hasContent && (
                <p className="mt-2 text-center text-xs text-stone-400">Add a product to enable generation</p>
              )}
            </div>

          </div>
        </aside>
      </div>
    </>
  );
}
