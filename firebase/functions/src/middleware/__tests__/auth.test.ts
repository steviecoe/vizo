import { describe, it, expect } from 'vitest';
import { requireAuth, requireRole, requireAdmin, requireTenantAdmin, resolveEffectiveTenantId } from '../auth';
import {
  makeAdminClaims,
  makeTenantAdminClaims,
  makeTenantUserClaims,
  makeImpersonationClaims,
} from '../../test/fixtures';
import type { CallableRequest } from 'firebase-functions/v2/https';

function mockRequest(auth: Record<string, unknown> | null): CallableRequest {
  return { auth, data: {}, rawRequest: {} } as unknown as CallableRequest;
}

describe('requireAuth', () => {
  it('returns claims for authenticated user', () => {
    const claims = makeAdminClaims();
    const result = requireAuth(mockRequest({ uid: 'uid-1', token: claims }));
    expect(result.role).toBe('vg_admin');
  });

  it('throws for unauthenticated request', () => {
    expect(() => requireAuth(mockRequest(null))).toThrow('Authentication required');
  });

  it('throws if user has no role', () => {
    expect(() =>
      requireAuth(mockRequest({ uid: 'uid-1', token: { role: undefined } })),
    ).toThrow('User has no assigned role');
  });
});

describe('requireRole', () => {
  it('allows matching role', () => {
    const claims = makeTenantAdminClaims();
    const result = requireRole(
      mockRequest({ uid: 'uid-1', token: claims }),
      'tenant_admin',
    );
    expect(result.role).toBe('tenant_admin');
  });

  it('allows if user role is in the list', () => {
    const claims = makeAdminClaims();
    const result = requireRole(
      mockRequest({ uid: 'uid-1', token: claims }),
      'vg_admin',
      'tenant_admin',
    );
    expect(result.role).toBe('vg_admin');
  });

  it('throws if role does not match', () => {
    const claims = makeTenantUserClaims();
    expect(() =>
      requireRole(mockRequest({ uid: 'uid-1', token: claims }), 'vg_admin'),
    ).toThrow('Forbidden');
  });
});

describe('requireAdmin', () => {
  it('allows vg_admin', () => {
    const claims = makeAdminClaims();
    const result = requireAdmin(mockRequest({ uid: 'uid-1', token: claims }));
    expect(result.role).toBe('vg_admin');
  });

  it('rejects tenant_admin', () => {
    const claims = makeTenantAdminClaims();
    expect(() =>
      requireAdmin(mockRequest({ uid: 'uid-1', token: claims })),
    ).toThrow('Forbidden');
  });
});

describe('requireTenantAdmin', () => {
  it('allows tenant_admin', () => {
    const claims = makeTenantAdminClaims();
    const result = requireTenantAdmin(mockRequest({ uid: 'uid-1', token: claims }));
    expect(result.role).toBe('tenant_admin');
  });

  it('allows vg_admin', () => {
    const claims = makeAdminClaims();
    const result = requireTenantAdmin(mockRequest({ uid: 'uid-1', token: claims }));
    expect(result.role).toBe('vg_admin');
  });

  it('rejects tenant_user', () => {
    const claims = makeTenantUserClaims();
    expect(() =>
      requireTenantAdmin(mockRequest({ uid: 'uid-1', token: claims })),
    ).toThrow('Forbidden');
  });
});

describe('resolveEffectiveTenantId', () => {
  it('returns impersonated tenant when impersonating', () => {
    const claims = makeImpersonationClaims({ impersonatedTenantId: 'tenant-99' });
    expect(resolveEffectiveTenantId(claims)).toBe('tenant-99');
  });

  it('returns own tenant when not impersonating', () => {
    const claims = makeTenantAdminClaims({ tenantId: 'tenant-5' });
    expect(resolveEffectiveTenantId(claims)).toBe('tenant-5');
  });

  it('throws when no tenant context', () => {
    const claims = makeAdminClaims();
    expect(() => resolveEffectiveTenantId(claims)).toThrow('No tenant context');
  });
});
