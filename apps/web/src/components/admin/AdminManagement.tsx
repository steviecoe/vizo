'use client';

import { useState, useEffect, useCallback } from 'react';
import { callFunction } from '@/lib/firebase/functions';
import { useAuth } from '@/lib/hooks/useAuth';

interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  addedBy?: string;
}

export function AdminManagement() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callFunction<{ admins: AdminUser[] }>('listAdmins');
      setAdmins(data.admins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await callFunction('addAdmin', { email: email.trim() });
      setEmail('');
      await fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(targetUid: string, targetEmail: string) {
    if (!confirm(`Remove ${targetEmail} as superadmin?`)) return;
    setError(null);
    try {
      await callFunction('removeAdmin', { targetUid });
      await fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove admin');
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-stone-900">Superadmin Management</h1>
        <p className="mt-1 text-sm text-stone-500">
          Manage platform superadmins who can access all admin features.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleAdd} className="mb-6 flex gap-3">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-950 focus:outline-none focus:ring-1 focus:ring-stone-950"
        />
        <button
          type="submit"
          disabled={adding || !email.trim()}
          className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add Admin'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-stone-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-stone-500">Added</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-stone-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {admins.map((admin) => (
                <tr key={admin.uid}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-stone-900">
                    {admin.email}
                    {admin.uid === user?.uid && (
                      <span className="ml-2 text-xs text-stone-400">(you)</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-stone-500">
                    {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    {admin.uid !== user?.uid && (
                      <button
                        onClick={() => handleRemove(admin.uid, admin.email)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-stone-500">
                    No admins found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
