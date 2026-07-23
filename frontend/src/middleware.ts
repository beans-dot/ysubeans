import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
    url.pathname = session.role === 'admin' ? '/' : '/dashboard';
    return NextResponse.redirect(url);
  }

  if (session && pathname.startsWith('/admin') && session.role !== 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (session && pathname === '/' && session.role === 'user') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|api/).*)',
  ],
};
