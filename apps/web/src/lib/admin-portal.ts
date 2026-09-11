export type SuperAdminNavId =
  | 'dashboard'
  | 'candidates'
  | 'employers'
  | 'jobs'
  | 'applications'
  | 'interviews'
  | 'skills'
  | 'ai-usage'
  | 'notifications'
  | 'reports'
  | 'admins'
  | 'settings'
  | 'audit';

/** Workflow roles: SUPER_ADMIN | ADMIN (PLATFORM_ADMIN) | OPERATIONS (PLATFORM_OPERATOR) */
export type StaffRole = 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_OPERATOR';

export function isStaffRole(role?: string | null): role is StaffRole {
  return role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN' || role === 'PLATFORM_OPERATOR';
}

/**
 * Super Admin Workflow capability matrix
 * Skills: Operator = Limited (view only)
 * AI Usage: Operator = View
 * Audit: Operator = Limited
 * Admin Users / Settings: Super Admin only
 */
export const ADMIN_NAV_ROLES: Record<SuperAdminNavId, StaffRole[]> = {
  dashboard: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
  candidates: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
  employers: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
  jobs: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
  applications: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
  interviews: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
  skills: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
  'ai-usage': ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
  notifications: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
  reports: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
  admins: ['SUPER_ADMIN'],
  settings: ['SUPER_ADMIN'],
  audit: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'],
};

export function canOpenAdminTab(role: string | null | undefined, tab: SuperAdminNavId) {
  if (!isStaffRole(role)) return false;
  return ADMIN_NAV_ROLES[tab].includes(role);
}

/** Manage jobs = publish/pause/close (workflow: all three roles). */
export function canManageJobs(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN' || role === 'PLATFORM_OPERATOR';
}

/** Skills write = create/edit/toggle (Operator = limited/view only). */
export function canManageSkills(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN';
}

export function canManageAdmins(role?: string | null) {
  return role === 'SUPER_ADMIN';
}

export function canManageAccounts(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN' || role === 'PLATFORM_OPERATOR';
}

export function roleLabel(role?: string | null) {
  if (role === 'SUPER_ADMIN') return 'Super admin';
  if (role === 'PLATFORM_ADMIN') return 'Platform admin';
  if (role === 'PLATFORM_OPERATOR') return 'Platform operator';
  return 'Staff';
}
