import type { UserRole } from '../types/auth';

export const ROLES: Record<UserRole, UserRole> = {
  vg_admin: 'vg_admin',
  tenant_admin: 'tenant_admin',
  tenant_user: 'tenant_user',
} as const;

export const TENANT_ADMIN_PERMISSIONS = [
  'invite_users',
  'topup_credits',
  'change_art_direction',
  'configure_shopify',
] as const;

export type TenantAdminPermission = (typeof TENANT_ADMIN_PERMISSIONS)[number];
