import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { homePathForRole, parseSessionCookie, SESSION_COOKIE } from '@/lib/auth';

function isHealthPath(pathname: string): boolean {
  return pathname === '/health' || pathname === '/api/health';
}

function isNonBrowserProbe(request: NextRequest): boolean {
  const accept = request.headers.get('accept') || '';
  return !accept.includes('text/html');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isHealthPath(pathname)) {
    return NextResponse.json({ status: 'ok' });
  }

  // Deploy health checks hit GET / without a browser Accept header.
  if (pathname === '/' && isNonBrowserProbe(request)) {
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
    '/((?!_next/static|_next/image|favicon.ico|logo.png|health|api/).*)',
  ],
};
