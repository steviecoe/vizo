'use client';

import { useReducer, useEffect } from 'react';
import Link from 'next/link';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────

interface HomepageConfig {
  hero: {
    imageUrl: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
  };
  whatsNew: Array<{
    imageUrl: string;
    title: string;
    description: string;
    tag: string;
    createdAt: string;
  }>;
  trending: Array<{
    imageUrl: string;
    title: string;
    author: string;
  }>;
}

interface DashboardStats {
  creditBalance: number;
  totalGenerated: number;
  approvedImages: number;
  pendingImages: number;
  rejectedImages: number;
  totalProducts: number;
  recentLedger: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
}

type PageStatus = 'loading' | 'idle' | 'error';

interface DashboardState {
  status: PageStatus;
  stats: DashboardStats | null;
  homepage: HomepageConfig | null;
  serverError: string | null;
}

type DashboardAction =
  | { type: 'SET_LOADED'; stats: DashboardStats; homepage: HomepageConfig | null }
  | { type: 'SET_ERROR'; error: string };

const initialState: DashboardState = {
  status: 'loading',
  stats: null,
  homepage: null,
  serverError: null,
};

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_LOADED':
      return { status: 'idle', stats: action.stats, homepage: action.homepage, serverError: null };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    default:
      return state;
  }
}

// ─── Default content ──────────────────────────────────────

const defaultHero = {
  imageUrl: '/images/hero-bg.png',
  title: 'Mastering High-Fashion AI Generatives',
  subtitle: 'Generate on-brand imagery at scale — no photoshoot needed.',
  ctaText: 'Start Generating',
  ctaLink: '/tenant/generate/quick',
};

const defaultWhatsNew = [
  {
    imageUrl: '/images/studio-v2-live.png',
    title: 'Studio V2.0 Live',
    description: 'Faster generation, better realism.',
    tag: 'Update',
    createdAt: '2 days ago',
  },
  {
    imageUrl: '/images/photoshoot-mode.png',
    title: 'Photoshoot Mode',
    description: 'Schedule overnight bulk shoots.',
    tag: 'Feature',
    createdAt: '1 week ago',
  },
  {
    imageUrl: '/images/shopify-sync.png',
    title: 'Shopify Sync',
    description: 'Push images directly to your store.',
    tag: 'Integration',
    createdAt: '2 weeks ago',
  },
];

const defaultTrending = [
  {
    imageUrl: '/images/soft-studio-look.png',
    title: 'Soft Studio Look',
    author: '@atelier_design',
  },
  {
    imageUrl: '/images/urban-minimal.png',
    title: 'Urban Minimal',
    author: '@future_fit',
  },
  {
    imageUrl: '/images/bold-editorial.png',
    title: 'Bold Editorial',
    author: '@luxury_watch',
  },
  {
    imageUrl: '/images/urban-minimal-2.png',
    title: 'Urban Minimal II',
    author: '@vogue_ai',
  },
  {
    imageUrl: '/images/bold-editorial-2.png',
    title: 'Bold Editorial II',
    author: '@creative_unit',
  },
  {
    imageUrl: '/images/soft-studio-look-2.png',
    title: 'Soft Studio Look II',
    author: '@atelier_design',
  },
  {
    imageUrl: '/images/urban-minimal-3.png',
    title: 'Urban Minimal III',
    author: '@future_fit',
  },
  {
    imageUrl: '/images/bold-editorial-3.png',
    title: 'Bold Editorial III',
    author: '@luxury_watch',
  },
  {
    imageUrl: '/images/urban-minimal-4.png',
    title: 'Urban Minimal IV',
    author: '@vogue_ai',
  },
  {
    imageUrl: '/images/bold-editorial-4.png',
    title: 'Bold Editorial IV',
    author: '@creative_unit',
  },
];

// ─── Component ────────────────────────────────────────────

export function TenantDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, stats, homepage, serverError } = state;

  useEffect(() => {
    async function load() {
      try {
        const [statsData, homepageData] = await Promise.all([
          callFunction<DashboardStats>('getTenantDashboard'),
          callFunction<HomepageConfig>('getHomepageConfig').catch(() => null),
        ]);
        dispatch({ type: 'SET_LOADED', stats: statsData, homepage: homepageData });
      } catch (err: unknown) {
        const error = err as { message?: string };
        dispatch({
          type: 'SET_ERROR',
          error: error.message || 'Failed to load dashboard',
        });
      }
    }
    load();
  }, []);

  // Use homepage config if available, otherwise default content
  const hero = homepage?.hero?.title ? homepage.hero : defaultHero;
  const whatsNew = homepage?.whatsNew?.length ? homepage.whatsNew : defaultWhatsNew;
  const trending = homepage?.trending?.length ? homepage.trending : defaultTrending;

  if (status === 'loading') {
    return (
      <>
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50 px-8">
          <div className="h-7 w-36 animate-pulse rounded bg-stone-200" />
        </header>
        <div className="flex-1 overflow-y-auto bg-stone-100 p-6">
          <div className="mx-auto max-w-[1400px] space-y-12">
            <div className="h-[520px] animate-pulse rounded-2xl bg-stone-200" />
            <div className="grid grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl bg-stone-200" />
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (status === 'error') {
    return (
      <>
        <header className="flex h-20 shrink-0 items-center border-b border-stone-200 bg-stone-50 px-8">
          <h1 className="font-display text-2xl font-bold text-stone-950">Dashboard</h1>
        </header>
        <div className="flex-1 overflow-y-auto bg-stone-100 p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6" role="alert">
            <h2 className="font-semibold text-red-800">Failed to load dashboard</h2>
            <p className="mt-1 text-sm text-red-700">{serverError}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50 px-8">
        <h1 className="font-display text-2xl font-bold text-stone-950">Dashboard</h1>
        <div className="flex items-center gap-6">
          {/* Stats summary pills */}
          {stats && (
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex h-8 items-center gap-2 rounded-full border border-stone-200 px-4">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange-400" />
                <span className="text-sm font-medium text-stone-500">Generated</span>
                <span className="text-sm font-bold text-stone-950">{stats.totalGenerated.toLocaleString()}</span>
              </div>
              <div className="flex h-8 items-center gap-2 rounded-full border border-stone-200 px-4">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-stone-500">Approved</span>
                <span className="text-sm font-bold text-stone-950">{stats.approvedImages.toLocaleString()}</span>
              </div>
              <div className="flex h-8 items-center gap-2 rounded-full border border-stone-200 px-4">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
                <span className="text-sm font-medium text-stone-500">Pending</span>
                <span className="text-sm font-bold text-stone-950">{stats.pendingImages.toLocaleString()}</span>
              </div>
            </div>
          )}
          <Link
            href="/tenant/generate/quick"
            className="rounded-full bg-stone-950 px-6 py-2.5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
          >
            New Project
          </Link>
        </div>
      </header>

      {/* Page Content */}
      <div className="flex-1 overflow-y-auto bg-stone-100 p-6 no-scrollbar">
        <div className="mx-auto max-w-[1400px] space-y-12">
          {/* Hero Section */}
          <section className="group relative">
            <div className="relative h-[520px] w-full overflow-hidden rounded-2xl bg-stone-900 shadow-2xl">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
                style={{ backgroundImage: `url('${hero.imageUrl}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex max-w-2xl flex-col justify-between gap-8 p-10 text-white">
                <span className="self-start rounded-full border border-white/20 bg-[#fff853] px-3 py-1 text-xs font-medium text-stone-950">
                  New Release
                </span>
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col gap-4">
                    <h1 className="font-display text-6xl font-extrabold leading-[1.0] tracking-tight lg:text-7xl">
                      {hero.title}
                    </h1>
                    <p className="max-w-md text-base font-normal leading-relaxed text-stone-200">
                      {hero.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link
                      href={hero.ctaLink || '/tenant/generate/quick'}
                      className="rounded-full bg-stone-950 px-6 py-3 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
                    >
                      {hero.ctaText || 'Start Generating'}
                    </Link>
                    <Link
                      href="/tenant/repository"
                      className="rounded-full border border-stone-400 bg-stone-50/10 px-6 py-3 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-50/20"
                    >
                      View Gallery
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* What's New Section */}
          <section>
            <div className="mb-8 flex items-center justify-between">
              <h2 className="font-display text-3xl font-bold text-stone-950">What&apos;s New</h2>
              <button className="rounded-full border border-stone-200 px-8 py-3 text-sm font-medium text-stone-950 transition-colors hover:bg-stone-100">
                Change log
              </button>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {whatsNew.map((item, i) => (
                <div
                  key={i}
                  className="group overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-sm transition-all hover:shadow-md p-px"
                >
                  <div className="h-[202px] overflow-hidden bg-stone-100 rounded-t-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col justify-between gap-3 px-6 py-4">
                    <span className="self-start rounded-full bg-[rgba(255,248,83,0.2)] px-2 py-1 text-xs font-medium text-stone-950">
                      {item.tag}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-stone-950">{item.title}</h3>
                      <p className="mt-0.5 text-sm font-medium text-stone-500">{item.description}</p>
                    </div>
                    <p className="text-xs text-stone-400">{item.createdAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Trending Generations Gallery */}
          <section className="pb-12">
            <div className="mb-2 flex flex-col items-center gap-1">
              <h2 className="font-display text-3xl font-bold text-stone-950">
                Trending Generations
              </h2>
              <p className="text-sm font-medium text-stone-500">Global Feed</p>
            </div>
            {/* Staggered 5-column waterfall grid */}
            <div className="mt-8 flex gap-7 overflow-hidden">
              {[0, 1, 2, 3, 4].map((col) => {
                const offsets = [0, 40, 80, 40, 0];
                const colItems = trending.filter((_, i) => i % 5 === col);
                if (colItems.length === 0 && trending[col]) {
                  colItems.push(trending[col]);
                }
                return (
                  <div
                    key={col}
                    className="flex flex-1 flex-col gap-7"
                    style={{ marginTop: offsets[col] }}
                  >
                    {(colItems.length > 0 ? colItems : [trending[col % trending.length]]).map((item, j) => (
                      <div
                        key={j}
                        className="group relative cursor-pointer overflow-hidden rounded-xl bg-stone-200 shadow-lg"
                        style={{ aspectRatio: '3/4' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent p-5 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                          <p className="font-display text-sm font-bold text-white">{item.title}</p>
                          <span className="mt-1 text-[10px] font-medium text-stone-300">{item.author}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer */}
          <footer className="flex items-center justify-between border-t border-stone-200 bg-stone-100 px-8 py-5">
            <p className="text-xs text-stone-400">
              &copy; 2026 Vizo Group. All rights reserved.
            </p>
            <div className="flex items-center gap-8 text-xs text-stone-400">
              <span className="cursor-pointer transition-colors hover:text-stone-900">Privacy Policy</span>
              <span className="cursor-pointer transition-colors hover:text-stone-900">Terms of Service</span>
              <span className="cursor-pointer transition-colors hover:text-stone-900">Contact Support</span>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
