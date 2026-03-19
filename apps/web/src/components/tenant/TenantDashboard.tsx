'use client';

import { useReducer, useEffect, useState } from 'react';
import Link from 'next/link';
import { callFunction } from '@/lib/firebase/functions';
import { Bell, Search, X, AlertTriangle, Image as ImageIcon, Users, HardDrive, Coins } from 'lucide-react';

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
  title: 'Generate entire collections in one click.',
  subtitle: 'Generate on-brand imagery at scale — no photoshoot needed.',
  ctaText: 'Start Photoshoot',
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
  { imageUrl: '/images/soft-studio-look.png', title: 'Soft Studio Look', author: '@atelier_design' },
  { imageUrl: '/images/urban-minimal.png', title: 'Urban Minimal', author: '@future_fit' },
  { imageUrl: '/images/bold-editorial.png', title: 'Bold Editorial', author: '@luxury_watch' },
  { imageUrl: '/images/urban-minimal-2.png', title: 'Urban Minimal II', author: '@vogue_ai' },
  { imageUrl: '/images/bold-editorial-2.png', title: 'Bold Editorial II', author: '@creative_unit' },
];

// ─── Mock notification data ───────────────────────────────

const MOCK_NOTIFICATIONS = [
  { id: '1', title: 'Summer Collection complete', body: '48 images generated successfully.', time: '2 min ago', read: false },
  { id: '2', title: 'Credits low', body: 'You have fewer than 100 credits remaining.', time: '1 hr ago', read: false },
  { id: '3', title: 'Shopify sync done', body: '12 approved images pushed to store.', time: '3 hr ago', read: true },
];

// ─── Mock recent photoshoot images ────────────────────────

const RECENT_SHOOTS = [
  { id: 'r1', title: 'Summer Collection', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&q=80' },
  { id: 'r2', title: 'Basics Range', url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&q=80' },
  { id: 'r3', title: 'Editorial Series', url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300&q=80' },
  { id: 'r4', title: 'Night Lookbook', url: 'https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?w=300&q=80' },
  { id: 'r5', title: 'Architecture', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=80' },
  { id: 'r6', title: 'Minimal Luxury', url: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=300&q=80' },
];

// ─── Component ────────────────────────────────────────────

export function TenantDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, stats, homepage, serverError } = state;

  const [creditBannerDismissed, setCreditBannerDismissed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

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
        dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to load dashboard' });
      }
    }
    load();
  }, []);

  const hero = homepage?.hero?.title ? homepage.hero : defaultHero;
  const whatsNew = homepage?.whatsNew?.length ? homepage.whatsNew : defaultWhatsNew;
  const trending = homepage?.trending?.length ? homepage.trending : defaultTrending;

  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;
  const showCreditWarning = !creditBannerDismissed && stats !== null && stats.creditBalance < 200;

  if (status === 'loading') {
    return (
      <>
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50 px-8">
          <div className="h-7 w-36 animate-pulse rounded bg-stone-200" />
        </header>
        <div className="flex-1 overflow-y-auto bg-stone-100 p-6">
          <div className="mx-auto max-w-[1400px] space-y-8">
            <div className="h-[480px] animate-pulse rounded-2xl bg-stone-200" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (<div key={i} className="h-24 animate-pulse rounded-xl bg-stone-200" />))}
            </div>
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (<div key={i} className="h-56 animate-pulse rounded-xl bg-stone-200" />))}
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
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-950">Dashboard</h1>
          <p className="text-xs text-stone-400">Creative overview</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search..."
              className="rounded-lg border border-stone-200 bg-stone-100 pl-9 pr-4 py-2 text-sm focus:border-stone-950 focus:ring-stone-950 w-48"
            />
          </div>

          {/* Notification bell */}
          <button
            onClick={() => setNotifOpen(true)}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* New Project */}
          <Link
            href="/tenant/generate/quick"
            className="rounded-full bg-stone-950 px-5 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
          >
            New Project
          </Link>
        </div>
      </header>

      {/* Notifications slide-over */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setNotifOpen(false)} />
          <div className="relative z-10 flex h-full w-80 flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <h3 className="text-base font-semibold font-display text-stone-900">Notifications</h3>
              <button onClick={() => setNotifOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {MOCK_NOTIFICATIONS.map((notif) => (
                <div key={notif.id} className={`border-b border-stone-100 px-5 py-4 ${!notif.read ? 'bg-stone-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    {!notif.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                    {notif.read && <span className="mt-1 h-2 w-2 shrink-0" />}
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{notif.title}</p>
                      <p className="text-xs text-stone-500">{notif.body}</p>
                      <p className="mt-1 text-[10px] text-stone-400">{notif.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="flex-1 overflow-y-auto bg-stone-100 p-6 no-scrollbar">
        <div className="mx-auto max-w-[1400px] space-y-10">

          {/* Low credit warning banner */}
          {showCreditWarning && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">Low credits:</span> You have {stats?.creditBalance ?? 0} credits remaining.{' '}
                  <Link href="/tenant/settings" className="underline font-medium">View Billing</Link>
                </p>
              </div>
              <button
                onClick={() => setCreditBannerDismissed(true)}
                className="text-amber-500 hover:text-amber-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Hero Banner */}
          <section className="group relative">
            <div className="relative h-[460px] w-full overflow-hidden rounded-2xl bg-stone-900 shadow-2xl">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
                style={{ backgroundImage: `url('${hero.imageUrl}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
              <div className="absolute inset-0 flex max-w-2xl flex-col justify-end gap-6 p-10 text-white">
                <span className="self-start rounded-full border border-white/20 bg-[#fff853] px-3 py-1 text-xs font-medium text-stone-950">
                  New Release
                </span>
                <div className="flex flex-col gap-4">
                  <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight lg:text-6xl">
                    {hero.title}
                  </h1>
                  <p className="max-w-md text-base text-stone-200">{hero.subtitle}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    href={hero.ctaLink || '/tenant/generate/quick'}
                    className="rounded-full bg-stone-950 px-6 py-3 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
                  >
                    {hero.ctaText || 'Start Photoshoot'}
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
          </section>

          {/* Stats Row */}
          <section>
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
              {[
                {
                  label: 'Images Generated',
                  value: stats ? stats.totalGenerated.toLocaleString() : '2,458',
                  icon: ImageIcon,
                  color: 'text-orange-500',
                  bg: 'bg-orange-50',
                },
                {
                  label: 'Active Models',
                  value: '12',
                  icon: Users,
                  color: 'text-stone-600',
                  bg: 'bg-stone-100',
                },
                {
                  label: 'Storage',
                  value: '45 GB',
                  icon: HardDrive,
                  color: 'text-stone-600',
                  bg: 'bg-stone-100',
                },
                {
                  label: 'Credits',
                  value: stats ? stats.creditBalance.toLocaleString() : '—',
                  icon: Coins,
                  color: 'text-rose-500',
                  bg: 'bg-rose-50',
                },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex shrink-0 items-center gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4 min-w-[200px]"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${stat.bg}`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold font-display text-stone-900">{stat.value}</p>
                      <p className="text-xs text-stone-500">{stat.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* My Recent Photoshoots */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-stone-950">My Recent Photoshoots</h2>
              <Link href="/tenant/repository" className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">
                View Image Library →
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory no-scrollbar">
              {RECENT_SHOOTS.map((shoot) => (
                <div
                  key={shoot.id}
                  className="group relative shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl bg-stone-200 shadow-sm"
                  style={{ width: 200, height: 260 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shoot.url}
                    alt={shoot.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/10 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <p className="text-sm font-semibold text-white">{shoot.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* What's New */}
          <section>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-stone-950">What&apos;s New</h2>
              <button className="rounded-full border border-stone-200 px-6 py-2.5 text-sm font-medium text-stone-950 transition-colors hover:bg-stone-100">
                Change log
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {whatsNew.map((item, i) => (
                <div
                  key={i}
                  className="group overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="h-[180px] overflow-hidden bg-stone-100 rounded-t-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col gap-2 px-5 py-4">
                    <span className="self-start rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                      {item.tag}
                    </span>
                    <div>
                      <h3 className="font-display text-base font-bold text-stone-950">{item.title}</h3>
                      <p className="mt-0.5 text-sm text-stone-500">{item.description}</p>
                    </div>
                    <p className="text-xs text-stone-400">{item.createdAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Trending Generations Gallery */}
          <section className="pb-12">
            <div className="mb-4 flex flex-col items-center gap-1">
              <h2 className="font-display text-2xl font-bold text-stone-950">Trending Generations</h2>
              <p className="text-sm text-stone-500">Global Feed</p>
            </div>
            <div className="mt-6 flex gap-6 overflow-hidden">
              {[0, 1, 2, 3, 4].map((col) => {
                const offsets = [0, 40, 80, 40, 0];
                const colItems = trending.filter((_, i) => i % 5 === col);
                if (colItems.length === 0 && trending[col]) colItems.push(trending[col]);
                return (
                  <div key={col} className="flex flex-1 flex-col gap-6" style={{ marginTop: offsets[col] }}>
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
                        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                          <p className="font-display text-sm font-bold text-white">{item.title}</p>
                          <span className="mt-0.5 text-[10px] text-stone-300">{item.author}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer */}
          <footer className="flex items-center justify-between border-t border-stone-200 py-5">
            <p className="text-xs text-stone-400">&copy; 2026 Vizo Group. All rights reserved.</p>
            <div className="flex items-center gap-6 text-xs text-stone-400">
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
