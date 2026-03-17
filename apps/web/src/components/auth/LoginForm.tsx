'use client';

import { useReducer } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  GoogleAuthProvider,
} from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase/client';

// ─── Types ────────────────────────────────────────────────

type LoginStatus = 'idle' | 'signing_in' | 'success' | 'error' | 'reset_sent';

interface LoginState {
  status: LoginStatus;
  email: string;
  password: string;
  serverError: string | null;
}

type LoginAction =
  | { type: 'SET_FIELD'; field: 'email' | 'password'; value: string }
  | { type: 'SET_SIGNING_IN' }
  | { type: 'SET_SUCCESS' }
  | { type: 'SET_RESET_SENT' }
  | { type: 'SET_ERROR'; error: string };

const initialState: LoginState = {
  status: 'idle',
  email: '',
  password: '',
  serverError: null,
};

function reducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value, serverError: null };
    case 'SET_SIGNING_IN':
      return { ...state, status: 'signing_in', serverError: null };
    case 'SET_SUCCESS':
      return { ...state, status: 'success', serverError: null };
    case 'SET_RESET_SENT':
      return { ...state, status: 'reset_sent', serverError: null };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.';
    default:
      return 'An error occurred during sign-in. Please try again.';
  }
}

// ─── Component ────────────────────────────────────────────

export function LoginForm() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, email, password, serverError } = state;

  async function redirectByRole() {
    const auth = getClientAuth();
    const user = auth.currentUser;
    if (!user) return;
    const tokenResult = await user.getIdTokenResult(true);
    const role = tokenResult.claims.role as string | undefined;
    if (role === 'vg_admin') {
      window.location.href = '/admin/tenants';
    } else {
      window.location.href = '/tenant/dashboard';
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    dispatch({ type: 'SET_SIGNING_IN' });

    try {
      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, email, password);
      dispatch({ type: 'SET_SUCCESS' });
      await redirectByRole();
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      console.error('[LoginForm] Email sign-in error:', firebaseErr.code, firebaseErr.message);
      dispatch({
        type: 'SET_ERROR',
        error: firebaseErr.code ? mapFirebaseError(firebaseErr.code) : 'Sign-in failed',
      });
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      dispatch({ type: 'SET_ERROR', error: 'Enter your email address first.' });
      return;
    }
    dispatch({ type: 'SET_SIGNING_IN' });
    try {
      const auth = getClientAuth();
      await sendPasswordResetEmail(auth, email);
      dispatch({ type: 'SET_RESET_SENT' });
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (firebaseErr.code === 'auth/user-not-found') {
        dispatch({ type: 'SET_ERROR', error: 'No account found with this email.' });
      } else {
        dispatch({ type: 'SET_ERROR', error: 'Failed to send reset email. Please try again.' });
      }
    }
  }

  async function handleGoogleSignIn() {
    dispatch({ type: 'SET_SIGNING_IN' });

    try {
      const auth = getClientAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      await signInWithPopup(auth, provider);
      dispatch({ type: 'SET_SUCCESS' });
      await redirectByRole();
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      console.error('[LoginForm] Google sign-in error:', firebaseErr.code, firebaseErr.message);
      dispatch({
        type: 'SET_ERROR',
        error: firebaseErr.code ? mapFirebaseError(firebaseErr.code) : 'Google sign-in failed',
      });
    }
  }

  const isSubmitting = status === 'signing_in';

  if (status === 'success') {
    return (
      <div className="text-center" role="status">
        <p className="text-lg font-medium text-green-700">Sign-in successful</p>
        <p className="mt-1 text-sm text-stone-500">Redirecting to dashboard...</p>
      </div>
    );
  }

  if (status === 'reset_sent') {
    return (
      <div className="text-center" role="status">
        <p className="text-lg font-medium text-green-700">Password reset email sent</p>
        <p className="mt-2 text-sm text-stone-500">
          Check your inbox for <strong>{email}</strong> and follow the link to set your password.
        </p>
        <button
          onClick={() => dispatch({ type: 'SET_FIELD', field: 'password', value: '' })}
          className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo / Branding */}
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
          V
        </div>
        <h1 className="mt-4 text-2xl font-bold font-display text-stone-900">Sign in to Vizo</h1>
        <p className="mt-1 text-sm text-stone-500">
          AI-powered fashion photography platform
        </p>
      </div>

      {/* Google Sign-In */}
      <button
        onClick={handleGoogleSignIn}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-3 text-stone-500">or sign in with email</span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-stone-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'email', value: e.target.value })}
            className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-stone-700">
              Password
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isSubmitting}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
            >
              Forgot password?
            </button>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'password', value: e.target.value })}
            className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {serverError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !email || !password}
          className="w-full rounded-full bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
