import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { homePathForRole, parseSessionCookie, SESSION_COOKIE } from '@/lib/auth';

function isHealthPath(pathname: string): boolean {
  return pathname === '/health' || pathname === '/api/health';
}

function isHealthProbe(request: NextRequest): boolean {
  const accept = request.headers.get('accept') || '';
  const dest = request.headers.get('sec-fetch-dest') || '';
  if (dest === 'document') return false;
  if (accept.includes('text/html')) return false;
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isHealthPath(pathname)) {
    return NextResponse.json({ status: 'ok' });
  }

  // Container probes hit GET / with no browser Accept / Sec-Fetch-Dest.
  // Keep the login redirect for real browsers.
  if (pathname === '/' && isHealthProbe(request)) {
    return NextResponse.json({ status: 'ok' });
  }

  const session = parseSessionCookie(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  const isPublic =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/find-account';

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (session && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(session.role);
    return NextResponse.redirect(url);
  }

  if (session && pathname.startsWith('/admin') && session.role !== 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(session.role);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|api/|health).*)',
  ],
};
