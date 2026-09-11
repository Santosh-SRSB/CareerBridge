import type { SuperAdminNavId } from '@/lib/admin-portal';
import {
  ADMIN_NAV_ROLES,
  canManageAdmins,
  canManageJobs,
  canManageSkills,
  canOpenAdminTab,
  isStaffRole,
  roleLabel,
  type StaffRole,
} from '@/lib/admin-portal';

/** @deprecated Prefer admin-portal — kept for older imports. */
export type PlatformStaffRole = StaffRole;

export {
  ADMIN_NAV_ROLES,
  canManageAdmins,
  canManageJobs,
  canManageSkills,
  canOpenAdminTab,
  isStaffRole as isPlatformStaffRole,
  roleLabel,
};

export function navTabsForRole(role: string | null | undefined): SuperAdminNavId[] {
  if (!isStaffRole(role)) return [];
  return (Object.keys(ADMIN_NAV_ROLES) as SuperAdminNavId[]).filter((tab) =>
    ADMIN_NAV_ROLES[tab].includes(role),
  );
}

export function canManageAccounts(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN' || role === 'PLATFORM_OPERATOR';
}
