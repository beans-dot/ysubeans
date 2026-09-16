import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { homePathForRole, parseSessionCookie, SESSION_COOKIE } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = parseSessionCookie(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  const isAuthEntry =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/find-account';
  const isHealthPath =
    pathname === '/health' || pathname === '/api/health';

  if (isHealthPath) {
    return NextResponse.next();
  }

  // 헬스 프로브(브라우저 HTML이 아닌 GET /)는 인증 리다이렉트 없이 200을 반환한다.
  if (pathname === '/' && !session) {
    const accept = request.headers.get('accept') || '';
    if (!accept.includes('text/html')) {
      return NextResponse.json({ status: 'ok' });
    }
  }

  if (!session && !isAuthEntry) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (session && isAuthEntry) {
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
