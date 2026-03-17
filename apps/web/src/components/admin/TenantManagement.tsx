'use client';

import { useState, useEffect, useCallback } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase/client';
import { callFunction } from '@/lib/firebase/functions';
import { useAuth } from '@/lib/hooks/useAuth';
import { CreateTenantDialog } from './CreateTenantDialog';
import { EditTenantDialog } from './EditTenantDialog';
import { AdminTopupDialog } from './AdminTopupDialog';
import type { Tenant } from '@vizo/shared';

interface TenantRow extends Tenant {
  id: string;
}

export function TenantManagement() {
  const { refreshClaims } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [topupTenant, setTopupTenant] = useState<TenantRow | null>(null);
  const [editTenant, setEditTenant] = useState<TenantRow | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callFunction<{ tenants: TenantRow[] }>('listTenants');
      setTenants(data.tenants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  async function handleImpersonate(tenant: TenantRow) {
    setImpersonating(tenant.id);
    try {
      const data = await callFunction<{
        customToken: string;
        tenantName: string;
        tenantId: string;
      }>('impersonate', { targetTenantId: tenant.id });

      const auth = getClientAuth();
      await signInWithCustomToken(auth, data.customToken);
      await refreshClaims();

      // Redirect to tenant dashboard
      window.location.href = '/tenant/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impersonation failed');
      setImpersonating(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-900">Tenant Management</h1>
          <p className="mt-1 text-sm text-stone-600">
            Overview and management of all tenants.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Create Tenant
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Tenant Table */}
      <div className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
        {loading ? (
          <div className="p-8 text-center text-sm text-stone-500">
            Loading tenants...
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500">
            No tenants yet. Create one to get started.
          </div>
        ) : (
          <table className="w-full text-left text-sm" role="table">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th className="px-4 py-3 font-medium text-stone-700">Name</th>
                <th className="px-4 py-3 font-medium text-stone-700">Slug</th>
                <th className="px-4 py-3 font-medium text-stone-700 text-right">Price/Credit</th>
                <th className="px-4 py-3 font-medium text-stone-700 text-right">Credit Balance</th>
                <th className="px-4 py-3 font-medium text-stone-700">Status</th>
                <th className="px-4 py-3 font-medium text-stone-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {tenant.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    {tenant.slug}
                  </td>
                  <td className="px-4 py-3 text-right text-stone-700">
                    &pound;{tenant.pricePerCredit?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        tenant.creditBalance <= (tenant.lowCreditThreshold ?? 50)
                          ? 'font-semibold text-red-600'
                          : 'text-stone-700'
                      }
                    >
                      {tenant.creditBalance?.toLocaleString() ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        tenant.status === 'active'
                          ? 'bg-green-100 text-stone-950'
                          : 'bg-stone-100 text-stone-950'
                      }`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditTenant(tenant)}
                        className="rounded border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setTopupTenant(tenant)}
                        className="rounded border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                      >
                        Top Up
                      </button>
                      <button
                        onClick={() => handleImpersonate(tenant)}
                        disabled={impersonating === tenant.id}
                        className="rounded border border-stone-300 bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-950 hover:bg-stone-100 disabled:opacity-50"
                      >
                        {impersonating === tenant.id
                          ? 'Switching...'
                          : 'Log in as'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateTenantDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          fetchTenants();
        }}
      />

      <EditTenantDialog
        tenant={editTenant}
        onClose={() => setEditTenant(null)}
        onSaved={() => {
          setEditTenant(null);
          fetchTenants();
        }}
        onDeleted={() => {
          setEditTenant(null);
          fetchTenants();
        }}
      />

      <AdminTopupDialog
        tenant={topupTenant}
        onClose={() => setTopupTenant(null)}
        onCompleted={() => {
          setTopupTenant(null);
          fetchTenants();
        }}
      />
    </div>
  );
}
