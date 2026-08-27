import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'cb_auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/employer')) {
    return NextResponse.next();
  }

  // Public employer entry points (registration redirect)
  if (pathname === '/employer/register' || pathname.startsWith('/employer/register/')) {
    return NextResponse.next();
  }

  const signedIn = request.cookies.get(AUTH_COOKIE)?.value === '1';
  if (signedIn) {
    return NextResponse.next();
  }

  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.searchParams.set('role', 'employer');
  login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/employer/:path*'],
};
