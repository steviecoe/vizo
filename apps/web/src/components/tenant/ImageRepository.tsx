'use client';

import { useReducer, useEffect, useCallback } from 'react';
import type { GeneratedImage, ImageStatus } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────

type PageStatus = 'loading' | 'idle' | 'updating' | 'regenerating' | 'downloading' | 'error' | 'empty';
type FilterTab = 'all' | ImageStatus;

interface RepoState {
  status: PageStatus;
  images: (GeneratedImage & { id: string })[];
  activeFilter: FilterTab;
  selectedIds: Set<string>;
  regeneratingId: string | null;
  videoGeneratingId: string | null;
  serverError: string | null;
}

type RepoAction =
  | { type: 'SET_LOADED'; images: (GeneratedImage & { id: string })[] }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_FILTER'; filter: FilterTab }
  | { type: 'TOGGLE_SELECT'; id: string }
  | { type: 'SELECT_ALL'; ids: string[] }
  | { type: 'DESELECT_ALL' }
  | { type: 'SET_UPDATING' }
  | { type: 'UPDATE_STATUSES'; ids: string[]; status: ImageStatus }
  | { type: 'SET_REGENERATING'; id: string }
  | { type: 'REGENERATION_DONE'; oldId: string; newImage: GeneratedImage & { id: string } }
  | { type: 'REGENERATION_FAILED' }
  | { type: 'SET_DOWNLOADING' }
  | { type: 'DOWNLOAD_DONE' }
  | { type: 'SET_VIDEO_GENERATING'; id: string }
  | { type: 'VIDEO_DONE'; id: string }
  | { type: 'VIDEO_FAILED' };

const initialState: RepoState = {
  status: 'loading',
  images: [],
  activeFilter: 'all',
  selectedIds: new Set(),
  regeneratingId: null,
  videoGeneratingId: null,
  serverError: null,
};

function reducer(state: RepoState, action: RepoAction): RepoState {
  switch (action.type) {
    case 'SET_LOADED':
      return {
        ...state,
        status: action.images.length === 0 ? 'empty' : 'idle',
        images: action.images,
      };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    case 'SET_FILTER':
      return { ...state, activeFilter: action.filter, selectedIds: new Set() };
    case 'TOGGLE_SELECT': {
      const next = new Set(state.selectedIds);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, selectedIds: next };
    }
    case 'SELECT_ALL':
      return { ...state, selectedIds: new Set(action.ids) };
    case 'DESELECT_ALL':
      return { ...state, selectedIds: new Set() };
    case 'SET_UPDATING':
      return { ...state, status: 'updating', serverError: null };
    case 'UPDATE_STATUSES':
      return {
        ...state,
        status: 'idle',
        selectedIds: new Set(),
        images: state.images.map((img) =>
          action.ids.includes(img.id)
            ? { ...img, status: action.status }
            : img,
        ),
      };
    case 'SET_REGENERATING':
      return { ...state, status: 'regenerating', regeneratingId: action.id, serverError: null };
    case 'REGENERATION_DONE':
      return {
        ...state,
        status: 'idle',
        regeneratingId: null,
        images: [
          action.newImage,
          ...state.images.map((img) =>
            img.id === action.oldId ? { ...img, status: 'rejected' as ImageStatus } : img,
          ),
        ],
      };
    case 'REGENERATION_FAILED':
      return { ...state, status: 'idle', regeneratingId: null };
    case 'SET_DOWNLOADING':
      return { ...state, status: 'downloading', serverError: null };
    case 'DOWNLOAD_DONE':
      return { ...state, status: 'idle' };
    case 'SET_VIDEO_GENERATING':
      return { ...state, videoGeneratingId: action.id, serverError: null };
    case 'VIDEO_DONE':
      return { ...state, videoGeneratingId: null };
    case 'VIDEO_FAILED':
      return { ...state, videoGeneratingId: null };
    default:
      return state;
  }
}

// ─── Filter tabs config ───────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'waiting_approval', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

// ─── Component ────────────────────────────────────────────

export function ImageRepository() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, images, activeFilter, selectedIds, regeneratingId, videoGeneratingId, serverError } = state;

  const loadImages = useCallback(async (filter: FilterTab) => {
    try {
      const data = await callFunction<{
        images: (GeneratedImage & { id: string })[];
      }>('listImages', { statusFilter: filter });
      dispatch({ type: 'SET_LOADED', images: data.images });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: error.message || 'Failed to load images',
      });
    }
  }, []);

  useEffect(() => {
    loadImages(activeFilter);
  }, [activeFilter, loadImages]);

  const filteredImages =
    activeFilter === 'all'
      ? images
      : images.filter((img) => img.status === activeFilter);

  async function handleBulkAction(newStatus: 'approved' | 'rejected') {
    if (selectedIds.size === 0) return;

    dispatch({ type: 'SET_UPDATING' });

    try {
      const imageIds = [...selectedIds];
      await callFunction('updateImageStatus', {
        imageIds,
        status: newStatus,
      });
      dispatch({ type: 'UPDATE_STATUSES', ids: imageIds, status: newStatus });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: error.message || 'Failed to update image statuses',
      });
    }
  }

  async function handleRegenerate(imageId: string) {
    dispatch({ type: 'SET_REGENERATING', id: imageId });

    try {
      const result = await callFunction<{
        newImageId: string;
        jobId: string;
        creditsCost: number;
        status: string;
      }>('regenerateImage', { imageId });

      const now = new Date().toISOString();
      dispatch({
        type: 'REGENERATION_DONE',
        oldId: imageId,
        newImage: {
          id: result.newImageId,
          jobId: result.jobId,
          status: 'waiting_approval',
          storageUrl: '',
          thumbnailUrl: '',
          resolution: '1k',
          aspectRatio: '1:1',
          modelId: null,
          backgroundId: null,
          productId: null,
          shopifyExportStatus: null,
          shopifyImageId: null,
          promptUsed: '',
          creditsCharged: result.creditsCost,
          generatedAt: now,
          reviewedAt: null,
          reviewedBy: null,
          createdAt: now,
          aiModelUsed: 'gemini',
        },
      });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: error.message || 'Regeneration failed',
      });
      dispatch({ type: 'REGENERATION_FAILED' });
    }
  }

  async function handleBulkDownload() {
    if (selectedIds.size === 0) return;
    dispatch({ type: 'SET_DOWNLOADING' });

    try {
      const result = await callFunction<{
        downloadUrl: string;
        imageCount: number;
      }>('bulkDownloadImages', { imageIds: [...selectedIds] });

      // Trigger browser download
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = `vizo-images-${result.imageCount}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      dispatch({ type: 'DOWNLOAD_DONE' });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: error.message || 'Failed to download images',
      });
    }
  }

  async function handleMakeVideo(imageId: string) {
    dispatch({ type: 'SET_VIDEO_GENERATING', id: imageId });

    try {
      await callFunction('generateVideoFromImage', { imageId });
      dispatch({ type: 'VIDEO_DONE', id: imageId });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({
        type: 'SET_ERROR',
        error: error.message || 'Video generation failed',
      });
      dispatch({ type: 'VIDEO_FAILED' });
    }
  }

  function handleSelectAll() {
    const allIds = filteredImages.map((img) => img.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      dispatch({ type: 'DESELECT_ALL' });
    } else {
      dispatch({ type: 'SELECT_ALL', ids: allIds });
    }
  }

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-stone-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-900">Image Repository</h1>
        <p className="mt-1 text-sm text-stone-500">
          Review, approve, or reject generated images.
        </p>
        <p className="mt-2 text-[11px] text-stone-400">
          Regeneration requires a Gemini API key. Video generation uses Google Veo (same Gemini key). Push-to-Shopify requires a connected Shopify store.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <nav className="flex gap-1 rounded-lg bg-stone-100 p-1" role="tablist" aria-label="Image status filter">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? images.length
                : images.filter((img) => img.status === tab.key).length;

            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeFilter === tab.key}
                onClick={() => dispatch({ type: 'SET_FILTER', filter: tab.key })}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  activeFilter === tab.key
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </nav>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2" role="toolbar" aria-label="Bulk actions">
            <span className="text-sm text-stone-500">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => handleBulkAction('approved')}
              disabled={status === 'updating'}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => handleBulkAction('rejected')}
              disabled={status === 'updating'}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={handleBulkDownload}
              disabled={status === 'updating' || status === 'downloading'}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {status === 'downloading' ? 'Preparing...' : 'Download'}
            </button>
          </div>
        )}
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {status === 'empty' && (
        <div className="rounded-lg border-2 border-dashed border-stone-300 p-12 text-center">
          <p className="text-stone-500">No generated images yet.</p>
          <p className="mt-1 text-sm text-stone-400">
            Generate images to see them here for review.
          </p>
        </div>
      )}

      {filteredImages.length === 0 && images.length > 0 && (
        <div className="py-8 text-center">
          <p className="text-stone-500">
            No images with status &quot;{activeFilter.replace('_', ' ')}&quot;
          </p>
        </div>
      )}

      {/* Image Grid */}
      {filteredImages.length > 0 && (
        <>
          <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={
                  filteredImages.length > 0 &&
                  filteredImages.every((img) => selectedIds.has(img.id))
                }
                onChange={handleSelectAll}
                className="rounded border-stone-300"
              />
              Select all
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredImages.map((image) => (
              <article
                key={image.id}
                className={`group flex flex-col transition ${
                  selectedIds.has(image.id) ? 'ring-2 ring-stone-950 rounded-lg' : ''
                }`}
              >
                {/* Image section */}
                <div className="relative h-[212px] overflow-hidden rounded-t-lg bg-stone-100">
                  <img
                    src={image.thumbnailUrl}
                    alt={`Generated image ${image.id}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />

                  {/* Checkbox */}
                  <div className="absolute left-[10px] top-[10px] z-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(image.id)}
                      onChange={() => dispatch({ type: 'TOGGLE_SELECT', id: image.id })}
                      className="h-[13px] w-[13px] cursor-pointer rounded-[4px] border border-stone-200 bg-stone-50 shadow-sm accent-stone-950"
                      aria-label={`Select image ${image.id}`}
                    />
                  </div>

                  {/* Status badge */}
                  <div className="absolute right-[10px] top-[10px] z-10">
                    <span
                      className={`rounded-[30px] px-2 py-1 text-xs font-medium text-stone-950 ${
                        image.status === 'approved'
                          ? 'bg-green-200'
                          : image.status === 'rejected'
                            ? 'bg-red-200'
                            : 'bg-yellow-200'
                      }`}
                    >
                      {image.status === 'waiting_approval' ? 'Waiting' : image.status.charAt(0).toUpperCase() + image.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Info panel */}
                <div className="flex flex-col gap-1 rounded-b-lg border border-stone-200 bg-stone-50 p-3 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <span>{image.resolution} · {image.aspectRatio}</span>
                    <span>{image.creditsCharged} cr</span>
                  </div>
                  {(image.status === 'approved' || image.status === 'rejected') && (
                    <button
                      onClick={() => handleRegenerate(image.id)}
                      disabled={status === 'regenerating'}
                      className="mt-1 flex h-8 w-full items-center justify-center rounded-full border border-stone-200 text-xs font-medium text-stone-950 transition hover:bg-stone-100 disabled:opacity-50"
                      aria-label={`Regenerate image ${image.id}`}
                    >
                      {regeneratingId === image.id ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  )}
                  {image.status === 'approved' && (
                    <button
                      onClick={() => handleMakeVideo(image.id)}
                      disabled={videoGeneratingId !== null}
                      className="flex h-8 w-full items-center justify-center rounded-full border border-stone-200 text-xs font-medium text-stone-950 transition hover:bg-stone-100 disabled:opacity-50"
                      aria-label={`Make video from image ${image.id}`}
                    >
                      {videoGeneratingId === image.id ? 'Creating video...' : 'Make Video'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
