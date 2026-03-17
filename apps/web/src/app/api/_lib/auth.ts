import type { CustomClaims, UserRole } from '@vizo/shared';
import { getAuth } from './admin';
import { ApiError } from './errors';

export interface VerifiedRequest {
  uid: string;
  claims: CustomClaims;
}

/**
 * Verifies the Firebase ID token from the Authorization header.
 * Does NOT check for a role — individual handlers call requireAuth/requireAdmin as needed.
 */
export async function verifyAuth(authHeader: string | null): Promise<VerifiedRequest> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError('unauthenticated', 'Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);
  const decoded = await getAuth().verifyIdToken(token);

  const claims = decoded as unknown as CustomClaims;
  return { uid: decoded.uid, claims };
}

export function requireAuth(claims: CustomClaims): CustomClaims {
  if (!claims.role) {
    throw new ApiError('permission-denied', 'User has no assigned role');
  }
  return claims;
}

export function requireRole(claims: CustomClaims, ...roles: UserRole[]): CustomClaims {
  requireAuth(claims);
  if (!roles.includes(claims.role)) {
    throw new ApiError('permission-denied', `Forbidden: requires one of [${roles.join(', ')}]`);
  }
  return claims;
}

export function requireAdmin(claims: CustomClaims): CustomClaims {
  return requireRole(claims, 'vg_admin');
}

export function requireTenantAdmin(claims: CustomClaims): CustomClaims {
  return requireRole(claims, 'tenant_admin', 'vg_admin');
}

export function resolveEffectiveTenantId(claims: CustomClaims): string {
  if (claims.impersonating && claims.impersonatedTenantId) {
    return claims.impersonatedTenantId;
  }
  if (claims.tenantId) {
    return claims.tenantId;
  }
  throw new ApiError('failed-precondition', 'No tenant context available');
}
