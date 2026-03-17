'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/tenant/art-direction/models', label: 'Models' },
  { href: '/tenant/art-direction/backgrounds', label: 'Backgrounds' },
];

export default function ArtDirectionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-stone-50">
      <div className="border-b border-stone-200 bg-white px-8 pt-8">
        <h1 className="text-2xl font-bold text-stone-900">Art Direction</h1>
        <p className="mt-1 text-sm text-stone-500">Manage models and backgrounds for AI generation.</p>
        <nav className="mt-4 flex gap-6">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                  active
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-8">{children}</div>
    </div>
  );
}
