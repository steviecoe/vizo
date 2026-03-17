'use client';

import { useReducer, useEffect } from 'react';
import { artDirectionModelSchema, CLOTHING_SIZES } from '@vizo/shared';
import type { ArtDirectionModel } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';

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

// ─── Component ────────────────────────────────────────────

export function ModelLibrary() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, models, showForm, editingModel, formData, fieldErrors, serverError } = state;
  const isSubmitting = status === 'creating' || status === 'editing';

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

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (<div key={i} className="h-36 animate-pulse rounded-lg bg-stone-200" />))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-900">Model Library</h1>
          <p className="mt-1 text-sm text-stone-500">Define reusable models with fashion-specific parameters for AI generation.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => dispatch({ type: 'SHOW_CREATE_FORM' })}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add Model
          </button>
        )}
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {/* ── Form ── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-stone-200 bg-stone-50 p-6">
          <h2 className="text-lg font-semibold font-display text-stone-900">
            {editingModel ? 'Edit Model' : 'Create Model'}
          </h2>

          <fieldset disabled={isSubmitting} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="model-name" className="block text-sm font-medium text-stone-700">Name</label>
              <input id="model-name" type="text" value={formData.name} onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'name', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.name[0]}</p>}
            </div>

            <div>
              <label htmlFor="model-gender" className="block text-sm font-medium text-stone-700">Gender</label>
              <select id="model-gender" value={formData.gender} onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'gender', value: e.target.value })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm">
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non-binary">Non-binary</option>
              </select>
            </div>

            <div>
              <label htmlFor="model-skin" className="block text-sm font-medium text-stone-700">Skin Colour</label>
              <input id="model-skin" type="text" value={formData.skinColour} onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'skinColour', value: e.target.value })} placeholder="e.g. light, medium, dark" className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              {fieldErrors.skinColour && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.skinColour[0]}</p>}
            </div>

            <div>
              <label htmlFor="model-hair" className="block text-sm font-medium text-stone-700">Hair Colour</label>
              <input id="model-hair" type="text" value={formData.hairColour} onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'hairColour', value: e.target.value })} placeholder="e.g. brown, blonde, black" className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              {fieldErrors.hairColour && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.hairColour[0]}</p>}
            </div>

            <div>
              <label htmlFor="model-height" className="block text-sm font-medium text-stone-700">Height</label>
              <input id="model-height" type="text" value={formData.height} onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'height', value: e.target.value })} placeholder="e.g. 175cm" className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              {fieldErrors.height && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.height[0]}</p>}
            </div>

            <div>
              <label htmlFor="model-size" className="block text-sm font-medium text-stone-700">Clothing Size (UK 8-18)</label>
              <select id="model-size" value={formData.clothingSize} onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'clothingSize', value: parseInt(e.target.value, 10) })} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm">
                {CLOTHING_SIZES.map((size) => (<option key={size} value={size}>UK {size}</option>))}
              </select>
            </div>

            <div>
              <label htmlFor="model-age" className="block text-sm font-medium text-stone-700">Age Range</label>
              <input id="model-age" type="text" value={formData.age} onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'age', value: e.target.value })} placeholder="e.g. 25-30" className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              {fieldErrors.age && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.age[0]}</p>}
            </div>
          </fieldset>

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={isSubmitting} className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {isSubmitting ? 'Saving...' : editingModel ? 'Update Model' : 'Create Model'}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'HIDE_FORM' })} disabled={isSubmitting} className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Model cards ── */}
      {models.length === 0 && !showForm && (
        <div className="rounded-lg border-2 border-dashed border-stone-300 p-12 text-center">
          <p className="text-stone-500">No models defined yet.</p>
          <p className="mt-1 text-sm text-stone-400">Add your first model to start generating fashion imagery.</p>
        </div>
      )}

      {models.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <article key={model.id} className="rounded-lg border border-stone-200 bg-stone-50 p-5 shadow-sm">
              <h3 className="font-semibold font-display text-stone-900">{model.name}</h3>
              <dl className="mt-3 space-y-1 text-sm text-stone-600">
                <div className="flex justify-between"><dt>Gender</dt><dd className="font-medium">{model.gender}</dd></div>
                <div className="flex justify-between"><dt>Skin</dt><dd className="font-medium">{model.skinColour}</dd></div>
                <div className="flex justify-between"><dt>Hair</dt><dd className="font-medium">{model.hairColour}</dd></div>
                <div className="flex justify-between"><dt>Height</dt><dd className="font-medium">{model.height}</dd></div>
                <div className="flex justify-between"><dt>Size</dt><dd className="font-medium">UK {model.clothingSize}</dd></div>
                <div className="flex justify-between"><dt>Age</dt><dd className="font-medium">{model.age}</dd></div>
              </dl>
              <div className="mt-4 flex gap-2">
                <button onClick={() => dispatch({ type: 'SHOW_EDIT_FORM', model })} className="text-sm text-brand-600 hover:text-brand-800">Edit</button>
                <button onClick={() => handleDelete(model.id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
