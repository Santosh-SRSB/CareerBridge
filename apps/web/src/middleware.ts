import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveAuthRedirect } from '@/lib/auth-route-guard';

const AUTH_COOKIE = 'cb_auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = request.cookies.get(AUTH_COOKIE)?.value === '1';
  const redirect = resolveAuthRedirect({
    pathname,
    search: request.nextUrl.searchParams,
    signedIn,
  });
  if (!redirect) {
    return NextResponse.next();
  }

  const login = request.nextUrl.clone();
  login.pathname = redirect.pathname;
  login.search = '';
  login.searchParams.set('role', redirect.role);
  login.searchParams.set('next', redirect.next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    '/employer/:path*',
    '/resume',
    '/resume/:path*',
    '/resumes',
    '/resumes/:path*',
    '/interviews',
    '/interviews/:path*',
  ],
};
