'use client';

import { useReducer, useEffect } from 'react';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────

interface TenantSummary {
  id: string;
  name: string;
  creditBalance: number;
  totalGenerated: number;
  totalApproved: number;
}

interface LedgerEntry {
  tenantId: string;
  tenantName: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface ReportingData {
  totalTenants: number;
  totalCreditsInSystem: number;
  totalCreditsSpent: number;
  totalImagesGenerated: number;
  totalImagesApproved: number;
  totalImagesRejected: number;
  totalJobs: number;
  images1k: number;
  images2k: number;
  estimatedAiCost: number;
  creditsRevenue: number;
  profitMargin: number;
  recentLedgerEntries: LedgerEntry[];
  topTenants: TenantSummary[];
}

interface DashboardState {
  loading: boolean;
  error: string | null;
  data: ReportingData | null;
}

type DashboardAction =
  | { type: 'LOADED'; data: ReportingData }
  | { type: 'SET_ERROR'; error: string };

const initialState: DashboardState = {
  loading: true,
  error: null,
  data: null,
};

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'LOADED':
      return { ...state, loading: false, data: action.data };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────

export function ReportingDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    async function load() {
      try {
        const data = await callFunction<ReportingData>('getReportingData');
        dispatch({ type: 'LOADED', data });
      } catch (err: unknown) {
        dispatch({ type: 'SET_ERROR', error: (err as { message?: string }).message || 'Failed to load reporting data' });
      }
    }
    load();
  }, []);

  if (state.loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-stone-200" />
          ))}
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {state.error}
      </div>
    );
  }

  const d = state.data!;

  const approvalRate = d.totalImagesGenerated > 0
    ? Math.round((d.totalImagesApproved / d.totalImagesGenerated) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-900">Reporting Dashboard</h1>
        <p className="mt-1 text-sm text-stone-500">Platform-wide analytics and credit reporting.</p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Total Tenants" value={d.totalTenants} />
        <StatCard label="Credits in System" value={d.totalCreditsInSystem} />
        <StatCard label="Credits Spent" value={d.totalCreditsSpent} />
        <StatCard label="Total Jobs" value={d.totalJobs} />
      </div>

      {/* Image Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Images Generated" value={d.totalImagesGenerated} />
        <StatCard label="Images Approved" value={d.totalImagesApproved} />
        <StatCard label="Images Rejected" value={d.totalImagesRejected} />
        <StatCard label="Approval Rate" value={`${approvalRate}%`} />
      </div>

      {/* AI Cost vs Revenue */}
      <section>
        <h2 className="text-lg font-semibold font-display text-stone-900">AI Cost vs Revenue</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard label="Estimated AI Cost" value={`$${d.estimatedAiCost.toFixed(2)}`} />
          <StatCard label="Credits Revenue" value={`$${d.creditsRevenue.toFixed(2)}`} />
          <StatCard label="Profit Margin" value={`${d.profitMargin}%`} />
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <dt className="text-sm text-stone-500">Image Breakdown</dt>
            <dd className="mt-1 text-sm text-stone-700">
              <span className="font-medium">{d.images1k}</span> at 1k,{' '}
              <span className="font-medium">{d.images2k}</span> at 2k
            </dd>
          </div>
        </div>
      </section>

      {/* Top Tenants */}
      <section>
        <h2 className="text-lg font-semibold font-display text-stone-900">Top Tenants by Generation Volume</h2>
        {d.topTenants.length === 0 ? (
          <p className="mt-2 text-sm text-stone-400">No tenant data yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-stone-500">Tenant</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-stone-500">Credits</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-stone-500">Generated</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-stone-500">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {d.topTenants.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 text-sm font-medium text-stone-900">{t.name}</td>
                    <td className="px-4 py-2 text-right text-sm text-stone-600">{t.creditBalance}</td>
                    <td className="px-4 py-2 text-right text-sm text-stone-600">{t.totalGenerated}</td>
                    <td className="px-4 py-2 text-right text-sm text-stone-600">{t.totalApproved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Ledger */}
      <section>
        <h2 className="text-lg font-semibold font-display text-stone-900">Recent Credit Activity</h2>
        {d.recentLedgerEntries.length === 0 ? (
          <p className="mt-2 text-sm text-stone-400">No credit activity yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-stone-500">Tenant</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-stone-500">Type</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-stone-500">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-stone-500">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-stone-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {d.recentLedgerEntries.map((entry, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-sm text-stone-900">{entry.tenantName}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${entry.amount >= 0 ? 'bg-green-100 text-stone-950' : 'bg-red-100 text-stone-950'}`}>
                        {entry.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={`px-4 py-2 text-right text-sm font-medium ${entry.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.amount >= 0 ? '+' : ''}{entry.amount}
                    </td>
                    <td className="px-4 py-2 text-sm text-stone-500 max-w-xs truncate">{entry.description}</td>
                    <td className="px-4 py-2 text-sm text-stone-400">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-stone-900">{value}</dd>
    </div>
  );
}
