export type AuthLoginRedirect = {
  pathname: '/login';
  role: 'candidate' | 'employer';
  next: string;
};

const HUMAN_MOCK_ROOM = /^\/interviews\/human\/[^/]+\/room\/?$/;

function tokenFromSearch(search: string | URLSearchParams | undefined): string {
  if (!search) return '';
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search;
  return params.get('token')?.trim() || '';
}

/** Invitees join with `?token=` and must not be forced through candidate login. */
export function isPublicHumanMockRoom(pathname: string, search?: string | URLSearchParams): boolean {
  return HUMAN_MOCK_ROOM.test(pathname) && Boolean(tokenFromSearch(search));
}

export function requiresCandidateAuth(pathname: string, search?: string | URLSearchParams): boolean {
  if (pathname === '/resume' || pathname.startsWith('/resume/')) return true;
  if (pathname === '/resumes' || pathname.startsWith('/resumes/')) return true;
  if (pathname === '/interviews' || pathname.startsWith('/interviews/')) {
    return !isPublicHumanMockRoom(pathname, search);
  }
  return false;
}

function isPublicEmployerPath(pathname: string): boolean {
  if (pathname === '/employer/register' || pathname.startsWith('/employer/register/')) return true;
  if (pathname === '/employer/welcome' || pathname.startsWith('/employer/welcome/')) return true;
  if (pathname === '/employer/terms' || pathname.startsWith('/employer/terms/')) return true;
  return false;
}

/** Returns a login redirect when the route is private and the visitor has no session cookie. */
export function resolveAuthRedirect(input: {
  pathname: string;
  search?: string | URLSearchParams;
  signedIn: boolean;
}): AuthLoginRedirect | null {
  const { pathname, signedIn } = input;

  if (pathname === '/employer' || pathname.startsWith('/employer/')) {
    if (isPublicEmployerPath(pathname) || signedIn) return null;
    return { pathname: '/login', role: 'employer', next: pathname };
  }

  if (requiresCandidateAuth(pathname, input.search)) {
    if (signedIn) return null;
    return { pathname: '/login', role: 'candidate', next: pathname };
  }

  return null;
}
