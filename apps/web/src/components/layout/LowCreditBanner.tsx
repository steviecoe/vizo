'use client';

import { useState, useEffect } from 'react';
import { callFunction } from '@/lib/firebase/functions';
import { useAuth } from '@/lib/hooks/useAuth';

export function LowCreditBanner() {
  const { claims } = useAuth();
  const [lowCredit, setLowCredit] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isTenant = claims?.role === 'tenant_admin' || claims?.role === 'tenant_user';

  useEffect(() => {
    if (!isTenant) return;

    async function checkBalance() {
      try {
        const data = await callFunction<{
          creditBalance: number;
          lowCreditThreshold: number;
        }>('getBillingInfo');
        setBalance(data.creditBalance);
        setLowCredit(data.creditBalance <= data.lowCreditThreshold);
      } catch {
        // Silently fail — banner is non-critical
      }
    }
    checkBalance();
  }, [isTenant]);

  if (!isTenant || !lowCredit || dismissed || balance === null) return null;

  return (
    <div
      className="flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-white"
      role="alert"
      aria-label="Low credit warning"
    >
      <span>
        Low credit balance: <strong>{balance} credits</strong> remaining.{' '}
        <a href="/tenant/credits" className="underline hover:text-white/80">
          Top up now
        </a>
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
        aria-label="Dismiss low credit warning"
      >
        Dismiss
      </button>
    </div>
  );
}
