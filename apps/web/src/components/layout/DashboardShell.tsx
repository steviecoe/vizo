'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileSidebarProvider, useMobileSidebar } from './MobileSidebarProvider';

function MobileMenuButton() {
  const { toggle } = useMobileSidebar();

  return (
    <button
      onClick={toggle}
      className="fixed left-4 top-4 z-50 rounded-lg border border-stone-200 bg-stone-50 p-2 shadow-md lg:hidden"
      aria-label="Toggle navigation menu"
    >
      <svg className="h-5 w-5 text-stone-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    </button>
  );
}

function MobileOverlay() {
  const { isOpen, close } = useMobileSidebar();
  const pathname = usePathname();

  // Close sidebar on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={close}
        aria-hidden="true"
      />
      {/* Sliding sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
        <Sidebar />
      </div>
    </>
  );
}

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileMenuButton />
      <MobileOverlay />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-stone-200 lg:block">
          <Sidebar />
        </aside>
        <main className="flex flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <MobileSidebarProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </MobileSidebarProvider>
  );
}
