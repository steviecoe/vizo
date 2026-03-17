import type { CallableRequest } from 'firebase-functions/v2/https';
import type { CustomClaims, UserRole } from '@vizo/shared';

export function requireAuth(request: CallableRequest): CustomClaims {
  if (!request.auth) {
    throw new Error('Authentication required');
  }

  const claims = request.auth.token as unknown as CustomClaims;
  if (!claims.role) {
    throw new Error('User has no assigned role');
  }

  return claims;
}

export function requireRole(request: CallableRequest, ...roles: UserRole[]): CustomClaims {
  const claims = requireAuth(request);
  if (!roles.includes(claims.role)) {
    throw new Error(`Forbidden: requires one of [${roles.join(', ')}]`);
  }
  return claims;
}

export function requireAdmin(request: CallableRequest): CustomClaims {
  return requireRole(request, 'vg_admin');
}

export function requireTenantAdmin(request: CallableRequest): CustomClaims {
  return requireRole(request, 'tenant_admin', 'vg_admin');
}

/**
 * Resolves the effective tenantId, accounting for impersonation.
 * If the user is impersonating, returns the impersonated tenant.
 * Otherwise returns the user's own tenant.
 */
export function resolveEffectiveTenantId(claims: CustomClaims): string {
  if (claims.impersonating && claims.impersonatedTenantId) {
    return claims.impersonatedTenantId;
  }
  if (claims.tenantId) {
    return claims.tenantId;
  }
  throw new Error('No tenant context available');
}
