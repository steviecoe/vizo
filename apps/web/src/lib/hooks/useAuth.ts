'use client';

import { useState, useCallback } from 'react';
import type { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  claims: Record<string, unknown> | null;
}

const MOCK_USER = {
  email: 'demo@vizogroup.com',
  displayName: 'Demo User',
  uid: 'mock-user-1',
} as unknown as User;

const MOCK_CLAIMS = {
  role: 'tenant_admin',
  tenantId: 'tenant-1',
  email: 'demo@vizogroup.com',
};

export function useAuth(): AuthState & { refreshClaims: () => Promise<void> } {
  const [state] = useState<AuthState>({
    user: MOCK_USER,
    loading: false,
    claims: MOCK_CLAIMS,
  });

  const refreshClaims = useCallback(async () => {}, []);

  return { ...state, refreshClaims };
}
