import type { AuthSession, AuthUser } from '@careerbridge/shared';
import { clearAllResumeClientState } from '@/features/resume/resume-wizard-draft';

const ACCESS = 'cb_access_token';
const REFRESH = 'cb_refresh_token';
const USER = 'cb_user';
export const AUTH_COOKIE = 'cb_auth';

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function setAuthCookie(present: boolean) {
  if (typeof document === 'undefined') return;
  if (present) {
    document.cookie = `${AUTH_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
  } else {
    document.cookie = `${AUTH_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
  }
}

export function saveSession(session: AuthSession) {
  if (!canUseBrowserStorage()) return;
  localStorage.setItem(ACCESS, session.accessToken);
  localStorage.setItem(REFRESH, session.refreshToken);
  localStorage.setItem(USER, JSON.stringify(session.user));
  setAuthCookie(true);
}

export function clearSession() {
  if (!canUseBrowserStorage()) return;
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
  setAuthCookie(false);
  try {
    clearAllResumeClientState();
  } catch {
    // ignore — sessionStorage may be unavailable
  }
}

export function getAccessToken() {
  if (!canUseBrowserStorage()) return null;
  return localStorage.getItem(ACCESS);
}

export function getRefreshToken() {
  if (!canUseBrowserStorage()) return null;
  return localStorage.getItem(REFRESH);
}

export function getStoredUser(): AuthUser | null {
  if (!canUseBrowserStorage()) return null;
  const raw = localStorage.getItem(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isEmployerRole(role?: string | null) {
  return role === 'EMPLOYER_ADMIN' || role === 'EMPLOYER_RECRUITER';
}

export function isPlatformRole(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN' || role === 'PLATFORM_OPERATOR';
}

export function isSuperAdminRole(role?: string | null) {
  return role === 'SUPER_ADMIN';
}

export type EmployerImpersonationMeta = {
  employerId: string;
  companyName: string;
  adminUserId: string;
};

const ADMIN_BACKUP = 'cb_admin_backup';
const IMPERSONATION = 'cb_impersonation';

/** Save admin tokens, then switch into an employer session. */
export function beginEmployerImpersonation(
  employerSession: AuthSession,
  meta: EmployerImpersonationMeta,
) {
  if (!canUseBrowserStorage()) return;
  const accessToken = localStorage.getItem(ACCESS);
  const refreshToken = localStorage.getItem(REFRESH);
  const userRaw = localStorage.getItem(USER);
  if (accessToken && refreshToken && userRaw) {
    localStorage.setItem(
      ADMIN_BACKUP,
      JSON.stringify({
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 0,
        user: JSON.parse(userRaw) as AuthUser,
      } satisfies AuthSession),
    );
  }
  localStorage.setItem(IMPERSONATION, JSON.stringify(meta));
  saveSession(employerSession);
}

export function getEmployerImpersonation(): EmployerImpersonationMeta | null {
  if (!canUseBrowserStorage()) return null;
  const raw = localStorage.getItem(IMPERSONATION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EmployerImpersonationMeta;
  } catch {
    return null;
  }
}

/** Restore the previous admin session. Returns false if no backup exists. */
export function endEmployerImpersonation(): boolean {
  if (!canUseBrowserStorage()) return false;
  const raw = localStorage.getItem(ADMIN_BACKUP);
  localStorage.removeItem(ADMIN_BACKUP);
  localStorage.removeItem(IMPERSONATION);
  if (!raw) return false;
  try {
    const backup = JSON.parse(raw) as AuthSession;
    if (!backup?.accessToken || !backup?.refreshToken || !backup?.user) return false;
    saveSession(backup);
    return true;
  } catch {
    return false;
  }
}

/** Role-aware home after login / "My home". */
export function homePathForUser(user?: AuthUser | null) {
  if (!user?.id) return '/';
  if (isPlatformRole(user.role)) return '/adminsrsb/dashboard';
  if (isEmployerRole(user.role)) return '/employer';
  if (user.dashboardReached) return '/dashboard';
  if (user.onboardingCompleted) return '/onboarding/complete';
  return '/onboarding/continue';
}

export function patchStoredUser(partial: Partial<AuthUser>) {
  const user = getStoredUser();
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  if (!user || !accessToken || !refreshToken) return;
  saveSession({
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 0,
    user: { ...user, ...partial },
  });
}
