import type { AuthSession, AuthUser } from '@careerbridge/shared';

const ACCESS = 'cb_access_token';
const REFRESH = 'cb_refresh_token';
const USER = 'cb_user';

export function saveSession(session: AuthSession) {
  localStorage.setItem(ACCESS, session.accessToken);
  localStorage.setItem(REFRESH, session.refreshToken);
  localStorage.setItem(USER, JSON.stringify(session.user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
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
