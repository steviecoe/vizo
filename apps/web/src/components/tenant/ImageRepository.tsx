'use client';

import { useReducer, useEffect, useCallback, useState } from 'react';
import type { GeneratedImage, ImageStatus } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Maximize2,
  Download,
  Check,
  X,
  Trash2,
  ShoppingBag,
  Plus,
} from 'lucide-react';

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
      return { ...state, status: action.images.length === 0 ? 'empty' : 'idle', images: action.images };
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
          action.ids.includes(img.id) ? { ...img, status: action.status } : img,
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

// ─── Mock photoshoot data ─────────────────────────────────

interface MockPhotoshoot {
  id: string;
  name: string;
  status: 'Complete' | 'In Progress';
  imageCount: number;
  date: string;
  images: string[];
}

const MOCK_PHOTOSHOOTS: MockPhotoshoot[] = [
  {
    id: 'ps-1',
    name: 'Summer Collection 2026',
    status: 'Complete',
    imageCount: 48,
    date: 'Mar 15, 2026',
    images: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80',
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80',
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80',
    ],
  },
  {
    id: 'ps-2',
    name: 'Basics Range — Spring',
    status: 'In Progress',
    imageCount: 12,
    date: 'Mar 18, 2026',
    images: [
      'https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?w=400&q=80',
      'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=400&q=80',
    ],
  },
  {
    id: 'ps-3',
    name: 'Editorial — Architectural',
    status: 'Complete',
    imageCount: 24,
    date: 'Mar 10, 2026',
    images: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80',
    ],
  },
  {
    id: 'ps-4',
    name: 'Lookbook — Night Series',
    status: 'In Progress',
    imageCount: 6,
    date: 'Mar 19, 2026',
    images: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
      'https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=400&q=80',
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80',
    ],
  },
];

// ─── Mock SKU group data ───────────────────────────────────

const MOCK_SKU_GROUPS = [
  {
    sku: 'SKU-0041',
    images: [
      { id: 'img-1', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&q=80', status: 'approved' as ImageStatus },
      { id: 'img-2', url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&q=80', status: 'waiting_approval' as ImageStatus },
      { id: 'img-3', url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300&q=80', status: 'rejected' as ImageStatus },
    ],
  },
  {
    sku: 'SKU-0042',
    images: [
      { id: 'img-4', url: 'https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?w=300&q=80', status: 'approved' as ImageStatus },
      { id: 'img-5', url: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=300&q=80', status: 'waiting_approval' as ImageStatus },
    ],
  },
];

// ─── Collage thumbnail component ─────────────────────────

function CollageThumb({ images }: { images: string[] }) {
  if (images.length === 0) {
    return <div className="h-full w-full bg-stone-200 rounded-lg" />;
  }
  if (images.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={images[0]} alt="" className="h-full w-full object-cover rounded-lg" />
    );
  }
  if (images.length === 2) {
    return (
      <div className="flex h-full w-full gap-0.5 rounded-lg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]} alt="" className="h-full w-1/2 object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[1]} alt="" className="h-full w-1/2 object-cover" />
      </div>
    );
  }
  // 3+ images: 2/3 main + 1/3 stack
  const extras = images.length - 3;
  return (
    <div className="flex h-full w-full gap-0.5 rounded-lg overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[0]} alt="" className="h-full w-2/3 object-cover" />
      <div className="flex h-full w-1/3 flex-col gap-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[1]} alt="" className="h-1/2 w-full object-cover" />
        <div className="relative h-1/2 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[2]} alt="" className="h-full w-full object-cover" />
          {extras > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-sm font-bold text-white">+{extras}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Status badge helper ──────────────────────────────────

function StatusBadge({ status }: { status: ImageStatus | 'Complete' | 'In Progress' }) {
  const map: Record<string, string> = {
    approved: 'bg-green-100 text-green-800',
    waiting_approval: 'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
    Complete: 'bg-green-100 text-green-800',
    'In Progress': 'bg-amber-100 text-amber-800',
  };
  const label: Record<string, string> = {
    approved: 'APPROVED',
    waiting_approval: 'WAITING',
    rejected: 'REJECTED',
    Complete: 'Complete',
    'In Progress': 'In Progress',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status] || 'bg-stone-100 text-stone-600'}`}>
      {label[status] || status}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────

export function ImageRepository() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, images, activeFilter, selectedIds, regeneratingId, serverError } = state;

  // Photoshoot drill-down state
  const [activePhotoshoot, setActivePhotoshoot] = useState<MockPhotoshoot | null>(null);
  const [photoshootFilter, setPhotoshootFilter] = useState<'all' | 'Complete' | 'In Progress'>('all');
  const [photoshootSearch, setPhotoshootSearch] = useState('');
  const [imageFilter, setImageFilter] = useState<'all' | ImageStatus>('all');
  const [skuSearch, setSkuSearch] = useState('');
  const [collapsedSkus, setCollapsedSkus] = useState<Set<string>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  const loadImages = useCallback(async (filter: FilterTab) => {
    try {
      const data = await callFunction<{ images: (GeneratedImage & { id: string })[] }>('listImages', { statusFilter: filter });
      dispatch({ type: 'SET_LOADED', images: data.images });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to load images' });
    }
  }, []);

  useEffect(() => {
    loadImages(activeFilter);
  }, [activeFilter, loadImages]);

  async function handleBulkAction(newStatus: 'approved' | 'rejected') {
    if (selectedIds.size === 0) return;
    dispatch({ type: 'SET_UPDATING' });
    try {
      const imageIds = [...selectedIds];
      await callFunction('updateImageStatus', { imageIds, status: newStatus });
      dispatch({ type: 'UPDATE_STATUSES', ids: imageIds, status: newStatus });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to update image statuses' });
    }
  }

  async function handleRegenerate(imageId: string) {
    dispatch({ type: 'SET_REGENERATING', id: imageId });
    try {
      const result = await callFunction<{ newImageId: string; jobId: string; creditsCost: number; status: string }>('regenerateImage', { imageId });
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
      dispatch({ type: 'SET_ERROR', error: error.message || 'Regeneration failed' });
      dispatch({ type: 'REGENERATION_FAILED' });
    }
  }

  async function handleBulkDownload() {
    if (selectedIds.size === 0) return;
    dispatch({ type: 'SET_DOWNLOADING' });
    try {
      const result = await callFunction<{ downloadUrl: string; imageCount: number }>('bulkDownloadImages', { imageIds: [...selectedIds] });
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = `vizo-images-${result.imageCount}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      dispatch({ type: 'DOWNLOAD_DONE' });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to download images' });
    }
  }

  function toggleSkuCollapse(sku: string) {
    setCollapsedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku); else next.add(sku);
      return next;
    });
  }

  function toggleImageSelect(id: string) {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSkuAllSelect(ids: string[]) {
    const allSelected = ids.every((id) => selectedImageIds.has(id));
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  // ── Photoshoot list view ───────────────────────────────

  const filteredPhotoshoots = MOCK_PHOTOSHOOTS.filter((ps) => {
    const matchesStatus = photoshootFilter === 'all' || ps.status === photoshootFilter;
    const matchesSearch = ps.name.toLowerCase().includes(photoshootSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const completeCount = MOCK_PHOTOSHOOTS.filter((p) => p.status === 'Complete').length;
  const inProgressCount = MOCK_PHOTOSHOOTS.filter((p) => p.status === 'In Progress').length;

  // ── Photoshoot detail view ─────────────────────────────

  const filteredSkuGroups = MOCK_SKU_GROUPS.filter((group) =>
    group.sku.toLowerCase().includes(skuSearch.toLowerCase())
  );

  const allImageIds = MOCK_SKU_GROUPS.flatMap((g) => g.images.map((i) => i.id));
  const approvedCount = MOCK_SKU_GROUPS.flatMap((g) => g.images).filter((i) => i.status === 'approved').length;
  const waitingCount = MOCK_SKU_GROUPS.flatMap((g) => g.images).filter((i) => i.status === 'waiting_approval').length;
  const rejectedCount = MOCK_SKU_GROUPS.flatMap((g) => g.images).filter((i) => i.status === 'rejected').length;

  if (status === 'loading' && !activePhotoshoot) {
    return (
      <>
        <header className="flex h-20 shrink-0 items-center border-b border-stone-200 bg-stone-50 px-8">
          <div className="h-7 w-48 animate-pulse rounded bg-stone-200" />
        </header>
        <div className="flex-1 overflow-y-auto bg-stone-100 p-6">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-stone-200" />
            ))}
          </div>
        </div>
      </>
    );
  }

  // ── Photoshoot Detail View ─────────────────────────────

  if (activePhotoshoot) {
    return (
      <>
        {/* Header */}
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50 px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setActivePhotoshoot(null); setSelectedImageIds(new Set()); }}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <span className="text-stone-300">/</span>
            <span className="text-sm text-stone-400">Photoshoots</span>
            <ChevronRight className="h-4 w-4 text-stone-300" />
            <h1 className="text-base font-semibold font-display text-stone-900">{activePhotoshoot.name}</h1>
          </div>
          <button className="flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-black">
            <Plus className="h-4 w-4" />
            Add Images
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-stone-100 p-6">
          <div className="mx-auto max-w-7xl">

            {serverError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{serverError}</p>
              </div>
            )}

            {/* Filters row */}
            <div className="mb-6 flex items-center gap-4">
              <nav className="flex gap-1 rounded-lg bg-white border border-stone-200 p-1" role="tablist">
                {[
                  { key: 'all', label: 'All Assets', count: allImageIds.length },
                  { key: 'waiting_approval', label: 'Waiting for Review', count: waitingCount },
                  { key: 'approved', label: 'Approved', count: approvedCount },
                  { key: 'rejected', label: 'Rejected', count: rejectedCount },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setImageFilter(tab.key as typeof imageFilter)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      imageFilter === tab.key
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </nav>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  placeholder="Search by SKU..."
                  className="w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 py-2 text-sm focus:border-stone-950 focus:ring-stone-950"
                />
              </div>
            </div>

            {/* SKU groups */}
            <div className="space-y-6">
              {filteredSkuGroups.map((group) => {
                const groupImages = imageFilter === 'all'
                  ? group.images
                  : group.images.filter((i) => i.status === imageFilter);
                const groupIds = groupImages.map((i) => i.id);
                const allGroupSelected = groupIds.length > 0 && groupIds.every((id) => selectedImageIds.has(id));
                const isCollapsed = collapsedSkus.has(group.sku);

                return (
                  <div key={group.sku} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                    {/* SKU header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={allGroupSelected}
                          onChange={() => toggleSkuAllSelect(groupIds)}
                          className="h-4 w-4 rounded border-stone-300 accent-stone-950"
                        />
                        <button
                          onClick={() => toggleSkuCollapse(group.sku)}
                          className="flex items-center gap-2 text-sm font-semibold text-stone-900"
                        >
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {group.sku}
                        </button>
                        <span className="text-xs text-stone-400">{group.images.length} images</span>
                      </div>
                    </div>

                    {/* Images grid */}
                    {!isCollapsed && (
                      <div className="p-5">
                        {groupImages.length === 0 ? (
                          <p className="py-4 text-center text-sm text-stone-400">No images match this filter.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {groupImages.map((img) => {
                              const isSelected = selectedImageIds.has(img.id);
                              return (
                                <div key={img.id} className="group relative">
                                  <div className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                                    isSelected ? 'border-stone-900' : 'border-transparent'
                                  }`}>
                                    {/* Image */}
                                    <div className="aspect-[3/4] bg-stone-100">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={img.url} alt={img.id} className="h-full w-full object-cover" loading="lazy" />
                                    </div>

                                    {/* Checkbox */}
                                    <div className="absolute left-2 top-2 z-10">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleImageSelect(img.id)}
                                        className="h-4 w-4 cursor-pointer rounded border-stone-200 accent-stone-950"
                                      />
                                    </div>

                                    {/* Status badge */}
                                    <div className="absolute right-2 top-2 z-10">
                                      <StatusBadge status={img.status} />
                                    </div>

                                    {/* Hover actions */}
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleRegenerate(img.id)}
                                        disabled={status === 'regenerating'}
                                        title="Regenerate"
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-800 hover:bg-white transition-colors"
                                      >
                                        {regeneratingId === img.id
                                          ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
                                          : <RefreshCw className="h-4 w-4" />
                                        }
                                      </button>
                                      <button
                                        title="View Full Size"
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-800 hover:bg-white transition-colors"
                                      >
                                        <Maximize2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Floating bulk action bar */}
        {selectedImageIds.size > 0 && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-2xl">
              <span className="mr-2 text-sm font-semibold text-stone-700">{selectedImageIds.size} selected</span>
              <button
                onClick={() => handleBulkAction('approved')}
                disabled={status === 'updating'}
                className="flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="h-3 w-3" /> Approve
              </button>
              <button
                onClick={() => handleBulkAction('rejected')}
                disabled={status === 'updating'}
                className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Reject
              </button>
              <button
                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
              <button
                onClick={handleBulkDownload}
                disabled={status === 'downloading'}
                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                {status === 'downloading' ? 'Preparing...' : 'Download'}
              </button>
              <button className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
                <ShoppingBag className="h-3 w-3" /> Export to Shopify
              </button>
              <button
                onClick={() => setSelectedImageIds(new Set())}
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Photoshoot List View ───────────────────────────────

  return (
    <>
      {/* Header */}
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50 px-8">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-900">Photoshoots</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={photoshootSearch}
              onChange={(e) => setPhotoshootSearch(e.target.value)}
              placeholder="Search photoshoots..."
              className="rounded-lg border border-stone-200 bg-white pl-9 pr-4 py-2 text-sm focus:border-stone-950 focus:ring-stone-950 w-56"
            />
          </div>
          <button className="flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-black">
            <Plus className="h-4 w-4" />
            New Photoshoot
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-stone-100 p-6">
        <div className="mx-auto max-w-7xl">

          {serverError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {/* Filter tabs */}
          <div className="mb-6 flex gap-1 rounded-lg bg-white border border-stone-200 p-1 w-fit">
            {[
              { key: 'all', label: 'All Photoshoots', count: MOCK_PHOTOSHOOTS.length },
              { key: 'Complete', label: 'Complete', count: completeCount },
              { key: 'In Progress', label: 'In Progress', count: inProgressCount },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPhotoshootFilter(tab.key as typeof photoshootFilter)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  photoshootFilter === tab.key
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Photoshoot grid */}
          {filteredPhotoshoots.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-stone-300 p-12 text-center">
              <p className="text-stone-500">No photoshoots found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPhotoshoots.map((ps) => (
                <button
                  key={ps.id}
                  onClick={() => setActivePhotoshoot(ps)}
                  className="group rounded-xl border border-stone-200 bg-white overflow-hidden text-left transition-all hover:shadow-md hover:border-stone-300"
                >
                  {/* Collage thumbnail */}
                  <div className="h-48 bg-stone-100 p-1">
                    <CollageThumb images={ps.images} />
                  </div>

                  {/* Card info */}
                  <div className="p-4">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-stone-900 leading-tight">{ps.name}</p>
                      <StatusBadge status={ps.status} />
                    </div>
                    <p className="text-xs text-stone-400">{ps.imageCount} images · {ps.date}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
