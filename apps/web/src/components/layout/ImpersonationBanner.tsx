'use client';

import { useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase/client';
import { callFunction } from '@/lib/firebase/functions';
import { useAuth } from '@/lib/hooks/useAuth';

export function ImpersonationBanner() {
  const { claims, refreshClaims } = useAuth();
  const [exiting, setExiting] = useState(false);

  const isImpersonating = claims?.impersonating === true;
  const tenantId = claims?.impersonatedTenantId as string | undefined;

  if (!isImpersonating) return null;

  async function handleExit() {
    setExiting(true);
    try {
      const data = await callFunction<{ customToken: string }>('endImpersonation');
      const auth = getClientAuth();
      await signInWithCustomToken(auth, data.customToken);
      await refreshClaims();
      window.location.href = '/admin/tenants';
    } catch {
      setExiting(false);
    }
  }

  return (
    <div
      className="flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-white"
      role="status"
      aria-label="Impersonation active"
    >
      <span>
        Impersonating tenant: <strong>{tenantId}</strong>
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 disabled:opacity-50"
      >
        {exiting ? 'Exiting...' : 'Exit Impersonation'}
      </button>
    </div>
  );
}
