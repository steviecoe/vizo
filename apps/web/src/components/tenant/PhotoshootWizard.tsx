'use client';

import { useReducer, useEffect } from 'react';
import { RESOLUTIONS, ASPECT_RATIOS, MAX_VARIANTS_PER_JOB } from '@vizo/shared';
import type { ArtDirectionModel, ArtDirectionBackground, ShopifyProduct } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';
import { AiLimitationsTooltip } from '@/components/shared/AiLimitationsTooltip';

// ─── Types ────────────────────────────────────────────────

type WizardStep = 'select' | 'configure' | 'schedule' | 'review' | 'submitting' | 'complete' | 'error';

interface WizardState {
  step: WizardStep;
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
  name: string;
  resolution: '1k' | '2k';
  aspectRatio: '1:1' | '4:5' | '16:9';
  variantCount: number;
  brief: string;
  isOvernight: boolean;
  // Result
  result: PhotoshootResult | null;
  serverError: string | null;
  validationErrors: string[];
}

interface PhotoshootResult {
  photoshootId: string;
  status: string;
  scheduledFor: string | null;
  totalImages: number;
  totalCreditsEstimate: number;
}

type WizardAction =
  | { type: 'ASSETS_LOADED'; models: (ArtDirectionModel & { id: string })[]; backgrounds: (ArtDirectionBackground & { id: string })[]; products: (ShopifyProduct & { id: string })[] }
  | { type: 'TOGGLE_MODEL'; id: string }
  | { type: 'TOGGLE_BACKGROUND'; id: string }
  | { type: 'TOGGLE_PRODUCT'; id: string }
  | { type: 'ADD_IMAGE_URL'; url: string }
  | { type: 'REMOVE_IMAGE_URL'; index: number }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_CONFIG'; field: 'resolution' | 'aspectRatio' | 'brief'; value: string }
  | { type: 'SET_VARIANT_COUNT'; count: number }
  | { type: 'SET_OVERNIGHT'; value: boolean }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_SUBMITTING' }
  | { type: 'SET_COMPLETE'; result: PhotoshootResult }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_VALIDATION_ERRORS'; errors: string[] }
  | { type: 'RESET' };

const initialState: WizardState = {
  step: 'select',
  models: [],
  backgrounds: [],
  products: [],
  assetsLoading: true,
  selectedModelIds: [],
  selectedBackgroundIds: [],
  selectedProductIds: [],
  itemImageUrls: [],
  name: '',
  resolution: '2k',
  aspectRatio: '4:5',
  variantCount: 3,
  brief: '',
  isOvernight: true,
  result: null,
  serverError: null,
  validationErrors: [],
};

function toggleInArray(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

const STEPS: WizardStep[] = ['select', 'configure', 'schedule', 'review'];

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
    case 'SET_NAME':
      return { ...state, name: action.name };
    case 'SET_CONFIG':
      return { ...state, [action.field]: action.value };
    case 'SET_VARIANT_COUNT':
      return { ...state, variantCount: action.count };
    case 'SET_OVERNIGHT':
      return { ...state, isOvernight: action.value };
    case 'NEXT_STEP': {
      const idx = STEPS.indexOf(state.step);
      return idx < STEPS.length - 1 ? { ...state, step: STEPS[idx + 1], validationErrors: [] } : state;
    }
    case 'PREV_STEP': {
      const idx = STEPS.indexOf(state.step);
      return idx > 0 ? { ...state, step: STEPS[idx - 1], validationErrors: [] } : state;
    }
    case 'SET_SUBMITTING':
      return { ...state, step: 'submitting', serverError: null };
    case 'SET_COMPLETE':
      return { ...state, step: 'complete', result: action.result };
    case 'SET_ERROR':
      return { ...state, step: 'error', serverError: action.error };
    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.errors };
    case 'RESET':
      return { ...initialState, assetsLoading: false, models: state.models, backgrounds: state.backgrounds, products: state.products };
    default:
      return state;
  }
}

// ─── Helpers ─────────────────────────────────────────────

function computeTotalImages(
  modelCount: number,
  bgCount: number,
  productCount: number,
  variantCount: number,
): number {
  return Math.max(modelCount, 1) * Math.max(bgCount, 1) * Math.max(productCount, 1) * variantCount;
}

// ─── Component ────────────────────────────────────────────

export function PhotoshootWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);

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

  const totalImages = computeTotalImages(
    state.selectedModelIds.length,
    state.selectedBackgroundIds.length,
    state.selectedProductIds.length + state.itemImageUrls.length,
    state.variantCount,
  );

  function validateSelect(): boolean {
    const errors: string[] = [];
    if (state.selectedModelIds.length === 0) {
      errors.push('Select at least one model for photoshoot mode.');
    }
    if (state.selectedBackgroundIds.length === 0) {
      errors.push('Select at least one background for photoshoot mode.');
    }
    if (errors.length > 0) {
      dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
      return false;
    }
    return true;
  }

  function validateConfigure(): boolean {
    const errors: string[] = [];
    if (!state.name.trim()) {
      errors.push('Photoshoot name is required.');
    }
    if (errors.length > 0) {
      dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
      return false;
    }
    return true;
  }

  function handleNext() {
    if (state.step === 'select' && !validateSelect()) return;
    if (state.step === 'configure' && !validateConfigure()) return;
    dispatch({ type: 'NEXT_STEP' });
  }

  async function handleSubmit() {
    dispatch({ type: 'SET_SUBMITTING' });

    try {
      const result = await callFunction<PhotoshootResult>('createPhotoshoot', {
        name: state.name,
        modelIds: state.selectedModelIds,
        backgroundIds: state.selectedBackgroundIds,
        productIds: state.selectedProductIds,
        itemImageUrls: state.itemImageUrls,
        resolution: state.resolution,
        aspectRatio: state.aspectRatio,
        variantCount: state.variantCount,
        brief: state.brief,
        isOvernight: state.isOvernight,
      });
      dispatch({ type: 'SET_COMPLETE', result });
    } catch (err: unknown) {
      dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Failed to create photoshoot' });
    }
  }

  if (state.assetsLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-900">Photoshoot Mode</h1>
        <p className="mt-1 text-sm text-stone-500">Bulk generation with multiple models, backgrounds, and products.</p>
        <div className="mt-2"><AiLimitationsTooltip /></div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-800">
          Photoshoot mode requires: (1) a Gemini API key configured for this tenant, (2) a Google Cloud Tasks queue named <code className="rounded bg-amber-100 px-1">photoshoot-worker</code>, and (3) the <code className="rounded bg-amber-100 px-1">PROCESS_PHOTOSHOOT_URL</code> environment variable on the backend. Without these, photoshoot creation will fail.
        </p>
      </div>

      {/* Step indicator */}
      <nav className="flex gap-2" aria-label="Wizard steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`flex items-center gap-1 text-sm font-medium ${state.step === s ? 'text-brand-700' : 'text-stone-400'}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${state.step === s ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-500'}`}>
              {i + 1}
            </span>
            {s === 'select' ? 'Select' : s === 'configure' ? 'Configure' : s === 'schedule' ? 'Schedule' : 'Review'}
          </div>
        ))}
      </nav>

      {/* Validation errors */}
      {state.validationErrors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          {state.validationErrors.map((err, i) => (
            <p key={i} role="alert" className="text-sm text-red-700">{err}</p>
          ))}
        </div>
      )}

      {/* Step 1: Select models, backgrounds, products */}
      {state.step === 'select' && (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold font-display text-stone-900">Models (required)</h2>
            {state.models.length === 0 ? (
              <p className="mt-2 text-sm text-stone-400">No models defined. Create models in Art Direction first.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {state.models.map((m) => (
                  <button key={m.id} onClick={() => dispatch({ type: 'TOGGLE_MODEL', id: m.id })} className={`rounded-full border px-3 py-1.5 text-sm ${state.selectedModelIds.includes(m.id) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-stone-300 text-stone-600 hover:border-stone-400'}`}>
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold font-display text-stone-900">Backgrounds (required)</h2>
            {state.backgrounds.length === 0 ? (
              <p className="mt-2 text-sm text-stone-400">No backgrounds defined. Create backgrounds in Art Direction first.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {state.backgrounds.map((bg) => (
                  <button key={bg.id} onClick={() => dispatch({ type: 'TOGGLE_BACKGROUND', id: bg.id })} className={`rounded-full border px-3 py-1.5 text-sm ${state.selectedBackgroundIds.includes(bg.id) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-stone-300 text-stone-600 hover:border-stone-400'}`}>
                    {bg.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold font-display text-stone-900">Products (optional)</h2>
            {state.products.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {state.products.map((p) => (
                  <button key={p.id} onClick={() => dispatch({ type: 'TOGGLE_PRODUCT', id: p.id })} className={`rounded-full border px-3 py-1.5 text-sm ${state.selectedProductIds.includes(p.id) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-stone-300 text-stone-600 hover:border-stone-400'}`}>
                    {p.title}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3">
              <label htmlFor="ps-image-url" className="block text-sm font-medium text-stone-700">Or add image URLs</label>
              <div className="mt-1 flex gap-2">
                <input
                  id="ps-image-url"
                  type="url"
                  placeholder="https://..."
                  className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      if (input.value) {
                        dispatch({ type: 'ADD_IMAGE_URL', url: input.value });
                        input.value = '';
                      }
                    }
                  }}
                />
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
          </section>

          <div className="flex justify-end">
            <button onClick={handleNext} className="rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Next: Configure
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {state.step === 'configure' && (
        <div className="space-y-6">
          <div>
            <label htmlFor="ps-name" className="block text-sm font-medium text-stone-700">Photoshoot Name</label>
            <input id="ps-name" type="text" value={state.name} onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })} placeholder="e.g. Spring Collection 2025" className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="ps-resolution" className="block text-sm font-medium text-stone-700">Resolution</label>
              <select id="ps-resolution" value={state.resolution} onChange={(e) => dispatch({ type: 'SET_CONFIG', field: 'resolution', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm">
                {RESOLUTIONS.map((r) => (<option key={r} value={r}>{r === '1k' ? '1024×1024' : '2048×2048'}</option>))}
              </select>
            </div>

            <div>
              <label htmlFor="ps-aspect-ratio" className="block text-sm font-medium text-stone-700">Aspect Ratio</label>
              <select id="ps-aspect-ratio" value={state.aspectRatio} onChange={(e) => dispatch({ type: 'SET_CONFIG', field: 'aspectRatio', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm">
                {ASPECT_RATIOS.map((ar) => (<option key={ar} value={ar}>{ar}</option>))}
              </select>
            </div>

            <div>
              <label htmlFor="ps-variant-count" className="block text-sm font-medium text-stone-700">Variants per combo (1-{MAX_VARIANTS_PER_JOB})</label>
              <input id="ps-variant-count" type="number" min={1} max={MAX_VARIANTS_PER_JOB} value={state.variantCount} onChange={(e) => dispatch({ type: 'SET_VARIANT_COUNT', count: parseInt(e.target.value, 10) || 1 })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label htmlFor="ps-brief" className="block text-sm font-medium text-stone-700">Creative Brief (optional)</label>
            <textarea id="ps-brief" rows={4} value={state.brief} onChange={(e) => dispatch({ type: 'SET_CONFIG', field: 'brief', value: e.target.value })} placeholder="Describe the look you want across all combinations..." className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
          </div>

          <div className="flex justify-between">
            <button onClick={() => dispatch({ type: 'PREV_STEP' })} className="rounded-md border border-stone-300 px-6 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Back</button>
            <button onClick={handleNext} className="rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700">Next: Schedule</button>
          </div>
        </div>
      )}

      {/* Step 3: Schedule */}
      {state.step === 'schedule' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-6">
            <h2 className="text-lg font-semibold font-display text-stone-900">Scheduling</h2>
            <p className="mt-1 text-sm text-stone-500">
              Overnight photoshoots use discounted credit rates and run at 2 AM UTC.
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="schedule"
                  checked={!state.isOvernight}
                  onChange={() => dispatch({ type: 'SET_OVERNIGHT', value: false })}
                  className="h-4 w-4 text-brand-600"
                />
                <div>
                  <span className="text-sm font-medium text-stone-900">Start immediately</span>
                  <p className="text-xs text-stone-500">Standard credit rates apply.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="schedule"
                  checked={state.isOvernight}
                  onChange={() => dispatch({ type: 'SET_OVERNIGHT', value: true })}
                  className="h-4 w-4 text-brand-600"
                />
                <div>
                  <span className="text-sm font-medium text-stone-900">Schedule overnight</span>
                  <p className="text-xs text-stone-500">Discounted rates. Runs at 2 AM UTC.</p>
                </div>
              </label>
            </div>

            <div className="mt-6 rounded-md bg-stone-50 p-4">
              <p className="text-sm text-stone-700">
                <strong>Total combinations:</strong> {state.selectedModelIds.length} model(s) &times; {state.selectedBackgroundIds.length} background(s) &times; {Math.max(state.selectedProductIds.length + state.itemImageUrls.length, 1)} product(s)
              </p>
              <p className="mt-1 text-sm text-stone-700">
                <strong>Total images:</strong> {totalImages} ({state.variantCount} variant(s) per combination)
              </p>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => dispatch({ type: 'PREV_STEP' })} className="rounded-md border border-stone-300 px-6 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Back</button>
            <button onClick={handleNext} className="rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700">Next: Review</button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {state.step === 'review' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-6">
            <h2 className="text-lg font-semibold font-display text-stone-900">Photoshoot Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-500">Name</dt>
                <dd className="font-medium">{state.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Models</dt>
                <dd className="font-medium">{state.selectedModelIds.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Backgrounds</dt>
                <dd className="font-medium">{state.selectedBackgroundIds.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Products / Images</dt>
                <dd className="font-medium">{state.selectedProductIds.length + state.itemImageUrls.length || 'None'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Resolution</dt>
                <dd className="font-medium">{state.resolution === '1k' ? '1024×1024' : '2048×2048'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Aspect Ratio</dt>
                <dd className="font-medium">{state.aspectRatio}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Variants per combo</dt>
                <dd className="font-medium">{state.variantCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Total Images</dt>
                <dd className="font-bold text-brand-700">{totalImages}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Schedule</dt>
                <dd className="font-medium">{state.isOvernight ? 'Overnight (2 AM UTC)' : 'Immediate'}</dd>
              </div>
            </dl>
          </div>

          <div className="flex justify-between">
            <button onClick={() => dispatch({ type: 'PREV_STEP' })} className="rounded-md border border-stone-300 px-6 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Back</button>
            <button onClick={handleSubmit} className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700">
              {state.isOvernight ? 'Schedule Photoshoot' : 'Start Photoshoot'}
            </button>
          </div>
        </div>
      )}

      {/* Submitting state */}
      {state.step === 'submitting' && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-12 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-lg font-medium text-brand-800">Creating photoshoot...</p>
          <p className="mt-1 text-sm text-brand-600">Credits are being reserved for all combinations.</p>
        </div>
      )}

      {/* Complete state */}
      {state.step === 'complete' && state.result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold font-display text-green-900">
            Photoshoot {state.result.status === 'scheduled' ? 'Scheduled' : 'Started'}
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-green-600">Total Images</dt><dd className="font-medium text-green-900">{state.result.totalImages}</dd></div>
            <div className="flex justify-between"><dt className="text-green-600">Credits Reserved</dt><dd className="font-medium text-green-900">{state.result.totalCreditsEstimate}</dd></div>
            {state.result.scheduledFor && (
              <div className="flex justify-between"><dt className="text-green-600">Scheduled For</dt><dd className="font-medium text-green-900">{new Date(state.result.scheduledFor).toLocaleString()}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-green-600">Photoshoot ID</dt><dd className="font-mono text-xs text-green-700">{state.result.photoshootId}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-green-600">
            {state.result.status === 'scheduled'
              ? 'Images will be generated at the scheduled time. Failed images will be automatically refunded.'
              : 'Generation is in progress. Failed images will be automatically refunded.'}
          </p>
          <button onClick={() => dispatch({ type: 'RESET' })} className="mt-6 rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create Another
          </button>
        </div>
      )}

      {/* Error state */}
      {state.step === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold font-display text-red-900">Photoshoot Failed</h2>
          <p className="mt-2 text-sm text-red-700">{state.serverError}</p>
          <p className="mt-1 text-xs text-red-500">If credits were reserved, they will be automatically refunded for failed images.</p>
          <button onClick={() => dispatch({ type: 'RESET' })} className="mt-4 rounded-md border border-red-300 px-6 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
