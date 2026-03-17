'use client';

import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase/client';
import { callFunction } from '@/lib/firebase/functions';
import { useAuth } from '@/lib/hooks/useAuth';

type BootstrapStatus = 'idle' | 'signing-in' | 'bootstrapping' | 'success' | 'error';

interface BootstrapResult {
  message: string;
  uid: string;
}

export default function BootstrapPage() {
  const { user, loading, claims, refreshClaims } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<BootstrapStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BootstrapResult | null>(null);

  const isAdmin = claims?.role === 'vg_admin';
  const isDisabled = status === 'signing-in' || status === 'bootstrapping';

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus('signing-in');
    setError(null);
    try {
      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, email, password);
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setStatus('error');
    }
  }

  async function handleGoogleSignIn() {
    setStatus('signing-in');
    setError(null);
    try {
      const auth = getClientAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setStatus('error');
    }
  }

  async function handleBootstrap() {
    setStatus('bootstrapping');
    setError(null);
    try {
      const data = await callFunction<BootstrapResult>('bootstrapSuperadmin');
      // Force token refresh to pick up new custom claims
      await refreshClaims();
      setResult(data);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bootstrap failed');
      setStatus('error');
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-stone-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-2 text-2xl font-bold text-stone-900">
          System Bootstrap
        </h1>
        <p className="mb-6 text-sm text-stone-500">
          One-time setup to create the first Superadmin account.
        </p>

        {/* SUCCESS STATE */}
        {status === 'success' && result && (
          <div className="rounded-md border border-green-200 bg-green-50 p-4">
            <h2 className="font-semibold text-green-800">
              Bootstrap Complete
            </h2>
            <p className="mt-1 text-sm text-green-700">{result.message}</p>
            <p className="mt-1 text-xs text-green-600">UID: {result.uid}</p>
            <a
              href="/admin/tenants"
              className="mt-4 inline-block rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              Go to Admin Dashboard
            </a>
          </div>
        )}

        {/* ALREADY ADMIN */}
        {status !== 'success' && isAdmin && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-stone-800">
              You are already a Superadmin.
            </p>
            <a
              href="/admin/tenants"
              className="mt-3 inline-block rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              Go to Admin Dashboard
            </a>
          </div>
        )}

        {/* SIGNED IN, NOT ADMIN -> SHOW BOOTSTRAP BUTTON */}
        {status !== 'success' && user && !isAdmin && (
          <div>
            <p className="mb-4 text-sm text-stone-600">
              Signed in as <strong>{user.email}</strong>
            </p>
            <button
              onClick={handleBootstrap}
              disabled={isDisabled}
              className="w-full rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'bootstrapping'
                ? 'Bootstrapping...'
                : 'Bootstrap Superadmin'}
            </button>
          </div>
        )}

        {/* NOT SIGNED IN -> SHOW SIGN-IN FORM */}
        {status !== 'success' && !user && (
          <div>
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="bootstrap-email"
                  className="block text-sm font-medium text-stone-700"
                >
                  Email
                </label>
                <input
                  id="bootstrap-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isDisabled}
                  className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-950 focus:outline-none focus:ring-1 focus:ring-stone-950 disabled:opacity-50"
                />
              </div>
              <div>
                <label
                  htmlFor="bootstrap-password"
                  className="block text-sm font-medium text-stone-700"
                >
                  Password
                </label>
                <input
                  id="bootstrap-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isDisabled}
                  className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-950 focus:outline-none focus:ring-1 focus:ring-stone-950 disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={isDisabled}
                className="w-full rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'signing-in' ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-xs text-stone-400">or</span>
              <div className="h-px flex-1 bg-stone-200" />
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={isDisabled}
              className="w-full rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign in with Google
            </button>
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </main>
  );
}
