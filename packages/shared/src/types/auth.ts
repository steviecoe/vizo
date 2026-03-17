export type UserRole = 'vg_admin' | 'tenant_admin' | 'tenant_user';

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface TenantUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'tenant_admin' | 'tenant_user';
  tenantId: string;
  invitedBy: string;
  status: 'pending' | 'active';
  createdAt: string;
}

export interface CustomClaims {
  role: UserRole;
  tenantId?: string;
  impersonating?: boolean;
  impersonatedTenantId?: string;
  originalUid?: string;
}

export interface ImpersonationRequest {
  targetTenantId: string;
}

export interface ImpersonationAuditEntry {
  action: 'impersonation_start' | 'impersonation_end';
  adminUid: string;
  adminEmail: string;
  targetTenantId: string;
  targetTenantName: string;
  timestamp: string;
}
