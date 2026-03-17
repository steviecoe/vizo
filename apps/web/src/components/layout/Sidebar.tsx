'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect, useState } from 'react';
import { callFunction } from '@/lib/firebase/functions';

// ─── Logo ─────────────────────────────────────────────────

function VizoLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/vizo_logo.svg" alt="Vizo" width={103} height={29} />
  );
}

// ─── Icons ────────────────────────────────────────────────

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconStudio({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconImages({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconArtDirection({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconPhotoshoot({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconProducts({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconTenants({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconCosts({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconHomepage({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconReporting({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconContent({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V9a2 2 0 012-2h2a2 2 0 012 2v9a2 2 0 01-2 2h-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function IconHelp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

// ─── Nav items ────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefix?: boolean;
}

const tenantMainLinks: NavItem[] = [
  { href: '/tenant/dashboard', label: 'Dashboard', icon: IconDashboard },
  { href: '/tenant/generate/quick', label: 'Studio', icon: IconStudio },
  { href: '/tenant/repository', label: 'Image Repository', icon: IconImages },
  { href: '/tenant/art-direction/models', label: 'Art Direction', icon: IconArtDirection, matchPrefix: true },
  { href: '/tenant/generate/photoshoot', label: 'Photoshoot', icon: IconPhotoshoot },
  { href: '/tenant/products', label: 'Products', icon: IconProducts },
];

const adminMainLinks: NavItem[] = [
  { href: '/admin/tenants', label: 'Tenants', icon: IconTenants },
  { href: '/admin/admins', label: 'Superadmins', icon: IconSettings },
  { href: '/admin/credit-costs', label: 'Credit Costs', icon: IconCosts },
  { href: '/admin/homepage-editor', label: 'Homepage Editor', icon: IconHomepage },
  { href: '/admin/cms', label: 'Content CMS', icon: IconContent },
  { href: '/admin/reporting', label: 'Reporting', icon: IconReporting },
];

// ─── Component ────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const { user, claims } = useAuth();
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const role = claims?.role as string | undefined;
  const isAdmin = role === 'vg_admin';
  const isTenant = role === 'tenant_admin' || role === 'tenant_user';
  const isImpersonating = !!claims?.impersonatedTenantId;

  const showAdmin = isAdmin && !isImpersonating;
  const showTenant = isTenant || isImpersonating;

  useEffect(() => {
    if (!showTenant) return;
    callFunction<{ creditBalance: number }>('getTenantDashboard')
      .then((data) => setCreditBalance(data.creditBalance))
      .catch(() => {});
  }, [showTenant]);

  function isActive(item: NavItem): boolean {
    if (item.matchPrefix) return pathname.startsWith('/tenant/art-direction');
    return pathname === item.href;
  }

  function renderLink(item: NavItem) {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex h-11 w-full items-center gap-3 pl-4 text-sm font-medium transition-colors ${
          active
            ? 'text-stone-950 sidebar-active'
            : 'text-stone-500 hover:text-stone-900'
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {item.label}
      </Link>
    );
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const roleLabel = isAdmin ? 'Superadmin' : role === 'tenant_admin' ? 'Tenant Admin' : 'Tenant User';

  return (
    <div className="flex h-full flex-col bg-stone-50">

      {/* Logo */}
      <div className="flex h-20 shrink-0 items-center border-b border-stone-200 px-6">
        <VizoLogo />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pt-6 no-scrollbar">
        {showAdmin && adminMainLinks.map(renderLink)}
        {showTenant && tenantMainLinks.map(renderLink)}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-stone-200 bg-stone-50 flex flex-col gap-0">

        {/* Credits bar */}
        {showTenant && (
          <div className="px-6 pt-6 pb-4">
            <div className="rounded-lg bg-rose-100 px-3 pt-3 pb-3">
              <div className="mb-2 flex justify-between text-xs font-medium text-stone-950">
                <span>Credits</span>
                <span>{creditBalance !== null ? `${creditBalance.toLocaleString()} left` : '—'}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-rose-950/10">
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{
                    width: creditBalance !== null
                      ? `${Math.min(100, Math.max(5, (creditBalance / 5000) * 100))}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* User info row */}
        <div className="mx-6 mb-4 rounded-lg border border-stone-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-950 text-xs font-semibold text-stone-50">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-950 font-display">{displayName}</p>
                <p className="truncate text-xs text-stone-400">{roleLabel}</p>
              </div>
            </div>
            <Link
              href={isAdmin ? '/admin/admins' : '/tenant/settings'}
              title="Settings"
              className="shrink-0 text-stone-400 transition-colors hover:text-stone-700"
            >
              <IconSettings className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Help Center */}
        {showTenant && (
          <div className="border-t border-stone-200 px-6 py-4">
            <Link
              href="/tenant/support"
              className={`flex items-center gap-3 text-sm font-medium transition-colors ${
                pathname === '/tenant/support'
                  ? 'text-stone-950'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <IconHelp className="h-5 w-5 shrink-0" />
              Help Center
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
