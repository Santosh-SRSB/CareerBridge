import type { UserStatus } from '../prisma/client';

/**
 * Responses for the account-status endpoints. Built field by field so credentials on the
 * User/Admin rows (passwordHash, loginPassword, externalAuthId) are never sent to the client.
 */
export type UserStatusResult = {
  id: string;
  userType: string;
  status: UserStatus;
  email: string | null;
  phone: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminStatusResult = {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toUserStatusResult(user: UserStatusResult): UserStatusResult {
  return {
    id: user.id,
    userType: user.userType,
    status: user.status,
    email: user.email ?? null,
    phone: user.phone,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toAdminStatusResult(admin: AdminStatusResult): AdminStatusResult {
  return {
    id: admin.id,
    userId: admin.userId,
    email: admin.email,
    fullName: admin.fullName ?? null,
    status: admin.status,
    lastLoginAt: admin.lastLoginAt ?? null,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

/** Audit verb for the status an admin account was moved to (same convention as SUSPEND_/DEACTIVATE_/ACTIVATE_USER). */
export function adminStatusAuditAction(status: UserStatus): 'SUSPEND_ADMIN' | 'DEACTIVATE_ADMIN' | 'ACTIVATE_ADMIN' {
  if (status === 'SUSPENDED') return 'SUSPEND_ADMIN';
  if (status === 'INACTIVE') return 'DEACTIVATE_ADMIN';
  return 'ACTIVATE_ADMIN';
}
