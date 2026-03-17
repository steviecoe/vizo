import type { CreditLedgerEntry, CustomClaims } from '@vizo/shared';

export function makeAdminClaims(overrides?: Partial<CustomClaims>): CustomClaims {
  return {
    role: 'vg_admin',
    ...overrides,
  };
}

export function makeTenantAdminClaims(
  overrides?: Partial<CustomClaims>,
): CustomClaims {
  return {
    role: 'tenant_admin',
    tenantId: 'tenant-1',
    ...overrides,
  };
}

export function makeTenantUserClaims(
  overrides?: Partial<CustomClaims>,
): CustomClaims {
  return {
    role: 'tenant_user',
    tenantId: 'tenant-1',
    ...overrides,
  };
}

export function makeImpersonationClaims(
  overrides?: Partial<CustomClaims>,
): CustomClaims {
  return {
    role: 'vg_admin',
    impersonating: true,
    impersonatedTenantId: 'tenant-1',
    originalUid: 'admin-uid-1',
    ...overrides,
  };
}

export function makeLedgerEntry(
  overrides?: Partial<CreditLedgerEntry>,
): CreditLedgerEntry {
  return {
    id: 'ledger-1',
    type: 'topup_admin',
    amount: 100,
    balanceAfter: 1100,
    description: 'Test top-up',
    referenceId: null,
    createdAt: '2025-01-01T00:00:00Z',
    createdBy: 'admin-uid-1',
    ...overrides,
  };
}
