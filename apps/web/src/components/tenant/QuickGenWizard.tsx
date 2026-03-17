'use client';

import { useReducer, useEffect, useRef } from 'react';
import { RESOLUTIONS, ASPECT_RATIOS, MAX_VARIANTS_PER_JOB } from '@vizo/shared';
import type { ArtDirectionModel, ArtDirectionBackground, ShopifyProduct } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────

interface WizardState {
  // Assets
  models: (ArtDirectionModel & { id: string })[];
  backgrounds: (ArtDirectionBackground & { id: string })[];
  products: (ShopifyProduct & { id: string })[];
  assetsLoading: boolean;
  // Selections
  selectedModelIds: string[];
  selectedBackgroundIds: string[];
  selectedProductIds: string[];
  itemImageUrls: string[];
  // Config
  resolution: '1k' | '2k';
  aspectRatio: '1:1' | '4:5' | '16:9';
  variantCount: number;
  brief: string;
  // Generation state
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
  aspectRatio: '1:1',
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

// ─── Helpers ──────────────────────────────────────────────

function getCreditCost(resolution: string): number {
  return resolution === '2k' ? 10 : 5;
}

// ─── Component ────────────────────────────────────────────

export function QuickGenWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const urlInputRef = useRef<HTMLInputElement>(null);

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

  // Selected product for display
  const selectedProduct = state.products.find((p) => state.selectedProductIds.includes(p.id));

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
          <div className="w-1/3 animate-pulse bg-stone-50 p-6">
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
        {/* Configuration Panel */}
        <section className="w-2/3 overflow-y-auto border-r border-stone-200 bg-stone-50 p-8">
          <div className="mx-auto max-w-3xl space-y-10">
            {/* Configuration notice */}
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs text-amber-800">
                Image generation requires a Gemini API key configured for this tenant (set during tenant creation or via Admin &rarr; Edit Tenant). Without it, generation requests will fail. Fallback to Grok requires an X.AI API key in GCP Secret Manager.
              </p>
            </div>

            {/* 1. Product Selection */}
            <div>
              <h3 className="mb-4 text-xs font-bold font-display uppercase tracking-widest text-stone-400">
                1. Product Selection
              </h3>

              {selectedProduct ? (
                <div className="flex gap-6 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                  <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white">
                    {selectedProduct.images?.[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedProduct.images[0].url} alt={selectedProduct.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-300">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 py-2">
                    <h4 className="font-semibold text-stone-800">{selectedProduct.title}</h4>
                    <p className="mt-1 text-sm text-stone-500">
                      {selectedProduct.shopifyProductId ? `SKU: ${selectedProduct.shopifyProductId}` : 'Local product'}
                    </p>
                    <div className="mt-4 flex gap-2">
                      {selectedProduct.status === 'active' && (
                        <span className="rounded border border-green-100 bg-green-50 px-2 py-1 text-[10px] font-bold uppercase text-stone-950">
                          Active
                        </span>
                      )}
                      <span className="rounded border border-stone-200 bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase text-stone-950">
                        Selected
                      </span>
                    </div>
                    <button
                      onClick={() => dispatch({ type: 'TOGGLE_PRODUCT', id: selectedProduct.id })}
                      className="mt-6 border-b border-stone-900 pb-0.5 text-xs font-semibold text-stone-900"
                    >
                      Change Product
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-stone-200 p-6">
                  {state.products.length > 0 ? (
                    <div>
                      <p className="mb-3 text-sm font-medium text-stone-600">Select a product from your catalog:</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                    </div>
                  ) : (
                    <p className="text-sm text-stone-400">No products synced yet. Add image URLs below.</p>
                  )}

                  {/* Image URLs */}
                  <div className="mt-4 border-t border-stone-100 pt-4">
                    <label className="block text-xs font-semibold text-stone-600">Or add image URLs directly</label>
                    <div className="mt-2 flex gap-2">
                      <input
                        ref={urlInputRef}
                        type="url"
                        placeholder="https://..."
                        className="flex-1 rounded-lg border-stone-200 text-sm focus:border-stone-950 focus:ring-stone-950"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddUrl();
                          }
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
                            <span className="truncate">{url}</span>
                            <button onClick={() => dispatch({ type: 'REMOVE_IMAGE_URL', index: i })} className="text-red-500 hover:text-red-700">&times;</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Model Persona */}
            <div>
              <h3 className="mb-4 text-xs font-bold font-display uppercase tracking-widest text-stone-400">
                2. Model Persona
              </h3>
              {state.models.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {state.models.map((m) => {
                    const selected = state.selectedModelIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => dispatch({ type: 'TOGGLE_MODEL', id: m.id })}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          selected
                            ? 'border-stone-900 bg-stone-50'
                            : 'border-stone-100 hover:border-stone-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-stone-800">{m.name}</p>
                        {m.gender && (
                          <p className="mt-1 text-xs text-stone-500 capitalize">{m.gender}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center">
                  <p className="text-sm text-stone-400">
                    No model personas defined yet. Go to Art Direction to create some.
                  </p>
                </div>
              )}
            </div>

            {/* 3. Environment */}
            <div>
              <h3 className="mb-4 text-xs font-bold font-display uppercase tracking-widest text-stone-400">
                3. Environment
              </h3>
              {state.backgrounds.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {state.backgrounds.map((bg) => {
                    const selected = state.selectedBackgroundIds.includes(bg.id);
                    return (
                      <button
                        key={bg.id}
                        onClick={() => dispatch({ type: 'TOGGLE_BACKGROUND', id: bg.id })}
                        className={`overflow-hidden rounded-xl border-2 p-1 transition-all ${
                          selected ? 'border-stone-900' : 'border-stone-100 hover:border-stone-300'
                        }`}
                      >
                        {bg.referenceImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={bg.referenceImageUrl} alt={bg.name} className="mb-2 h-24 w-full rounded-lg object-cover" />
                        ) : (
                          <div className="mb-2 flex h-24 items-center justify-center rounded-lg bg-stone-100">
                            <svg className="h-8 w-8 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                            </svg>
                          </div>
                        )}
                        <p className="py-1 text-center text-[11px] font-semibold">{bg.name}</p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center">
                  <p className="text-sm text-stone-400">
                    No backgrounds defined yet. Go to Art Direction to create some.
                  </p>
                </div>
              )}
            </div>

            {/* 4. Creative Direction */}
            <div>
              <h3 className="mb-4 text-xs font-bold font-display uppercase tracking-widest text-stone-400">
                4. Creative Direction
              </h3>
              <textarea
                value={state.brief}
                onChange={(e) => dispatch({ type: 'SET_CONFIG', field: 'brief', value: e.target.value })}
                className="w-full rounded-xl border-stone-200 p-4 text-sm focus:border-stone-950 focus:ring-stone-950"
                placeholder="Describe the mood, lighting, or specific pose (e.g., 'Soft evening glow, high fashion editorial pose, sharp focus on fabric texture')"
                rows={3}
              />
            </div>

            {/* 5. Technical Settings */}
            <div className="flex items-center justify-between border-t border-stone-100 pt-6">
              <div className="flex items-center gap-8">
                {/* Resolution */}
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase text-stone-400">
                    Resolution
                  </label>
                  <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-1">
                    {RESOLUTIONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => dispatch({ type: 'SET_CONFIG', field: 'resolution', value: r })}
                        className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                          state.resolution === r
                            ? 'border border-stone-200 bg-white shadow-sm'
                            : 'text-stone-500 hover:text-stone-900'
                        }`}
                      >
                        {r === '1k' ? '1K' : '2K'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase text-stone-400">
                    Aspect Ratio
                  </label>
                  <div className="flex gap-2">
                    {ASPECT_RATIOS.map((ar) => (
                      <button
                        key={ar}
                        onClick={() => dispatch({ type: 'SET_CONFIG', field: 'aspectRatio', value: ar })}
                        className={`flex h-8 w-10 items-center justify-center rounded text-[10px] font-bold transition-colors ${
                          state.aspectRatio === ar
                            ? 'border-2 border-stone-900 bg-white'
                            : 'border border-stone-200 bg-white text-stone-400 hover:border-stone-400'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Variants */}
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase text-stone-400">
                    Variants
                  </label>
                  <div className="flex gap-2">
                    {Array.from({ length: MAX_VARIANTS_PER_JOB }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => dispatch({ type: 'SET_VARIANT_COUNT', count: n })}
                        className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold transition-colors ${
                          state.variantCount === n
                            ? 'border-2 border-stone-900 bg-white'
                            : 'border border-stone-200 bg-white text-stone-400 hover:border-stone-400'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Review / Queue Panel */}
        <section className="w-1/3 overflow-y-auto bg-stone-50 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-bold font-display text-stone-800">Generation Status</h3>
          </div>

          <div className="space-y-4">
            {/* Active generation */}
            {state.generating && (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-100/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-tight text-stone-500">
                    Current Batch
                  </span>
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

            {/* Completed result */}
            {state.result && (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-100/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-tight text-stone-500">
                    Batch #{state.result.jobId.slice(0, 8)}
                  </span>
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-stone-950">
                    Complete
                  </span>
                </div>
                <div className="p-4 space-y-3">
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
                    <span className="font-semibold text-stone-900">
                      {state.result.creditsCost - state.result.creditsRefunded}
                    </span>
                  </div>
                  {state.result.creditsRefunded > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-500">Credits Refunded</span>
                      <span className="font-semibold text-green-700">{state.result.creditsRefunded}</span>
                    </div>
                  )}
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

            {/* Error state */}
            {state.serverError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">Generation Failed</p>
                <p className="mt-1 text-xs text-red-700">{state.serverError}</p>
                <p className="mt-2 text-[10px] text-red-500">
                  Credits for failed images are automatically refunded.
                </p>
                <button
                  onClick={() => dispatch({ type: 'RESET' })}
                  className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!state.generating && !state.result && !state.serverError && (
              <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
                <p className="mt-4 text-sm font-medium text-stone-500">No generations yet</p>
                <p className="mt-1 text-xs text-stone-400">
                  Configure your settings and click Generate to start.
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="rounded-xl bg-white border border-stone-200 p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">Summary</h4>
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
                <div className="flex justify-between border-t border-stone-100 pt-2">
                  <dt className="font-semibold text-stone-700">Estimated Cost</dt>
                  <dd className="font-bold text-stone-900">{creditCost} credits</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
