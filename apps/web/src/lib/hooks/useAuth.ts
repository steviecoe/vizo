'use client';

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  claims: Record<string, unknown> | null;
}

export function useAuth(): AuthState & { refreshClaims: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    claims: null,
  });

  useEffect(() => {
    // In mock mode, skip Firebase auth entirely and use a fake user
    if (process.env.NEXT_PUBLIC_MOCK_API === 'true') {
      setState({
        user: { email: 'demo@vizogroup.com', displayName: 'Demo User', uid: 'mock-user-1' } as unknown as import('firebase/auth').User,
        loading: false,
        claims: { role: process.env.NEXT_PUBLIC_MOCK_ROLE || 'tenant_admin', tenantId: 'tenant-1', email: 'demo@vizogroup.com' },
      });
      return;
    }

    const auth = getClientAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (process.env.NEXT_PUBLIC_MOCK_ROLE) {
          const mockRole = process.env.NEXT_PUBLIC_MOCK_ROLE;
          setState({
            user,
            loading: false,
            claims: {
              role: mockRole,
              tenantId: 'tenant-1',
              email: user.email,
            },
          });
        } else {
          const tokenResult = await user.getIdTokenResult();
          setState({
            user,
            loading: false,
            claims: tokenResult.claims,
          });
        }
      } else {
        setState({ user: null, loading: false, claims: null });
      }
    });
    return unsubscribe;
  }, []);

  const refreshClaims = useCallback(async () => {
    const auth = getClientAuth();
    const user = auth.currentUser;
    if (user) {
      const tokenResult = await user.getIdTokenResult(true);
      setState((prev) => ({
        ...prev,
        claims: tokenResult.claims,
      }));
    }
  }, []);

  return { ...state, refreshClaims };
}
