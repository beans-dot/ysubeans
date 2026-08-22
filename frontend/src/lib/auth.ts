export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

export const SESSION_COOKIE = 'ir_session';
export const TOKEN_COOKIE = 'ir_token';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7일

export function parseSessionCookie(value: string | undefined): AuthUser | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as AuthUser;
    if (!parsed?.id || (parsed.role !== 'admin' && parsed.role !== 'user')) {
      return null;
    }
    return { id: parsed.id, name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}

export function encodeSessionCookie(user: AuthUser): string {
  return encodeURIComponent(JSON.stringify(user));
}

function setCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  return match.slice(name.length + 1);
}

export function setSessionCookie(user: AuthUser) {
  setCookie(SESSION_COOKIE, encodeSessionCookie(user));
}

export function clearSessionCookie() {
  clearCookie(SESSION_COOKIE);
}

export function setTokenCookie(token: string) {
  setCookie(TOKEN_COOKIE, encodeURIComponent(token));
}

export function clearTokenCookie() {
  clearCookie(TOKEN_COOKIE);
}

export function readTokenFromDocument(): string | null {
  const raw = readCookie(TOKEN_COOKIE);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function readSessionFromDocument(): AuthUser | null {
  return parseSessionCookie(readCookie(SESSION_COOKIE) ?? undefined);
}

export function clearAuthCookies() {
  clearSessionCookie();
  clearTokenCookie();
}

export function homePathForRole(_role?: UserRole): string {
  return '/';
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (pathname.startsWith('/admin')) return role === 'admin';
  if (
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/competitiveness') ||
    pathname.startsWith('/monitoring') ||
    pathname.startsWith('/strategic-plan') ||
    pathname.startsWith('/update-history') ||
    pathname.startsWith('/profile')
  ) {
    return true;
  }
  return true;
}

export function isYeonsungEmail(email: string): boolean {
  return /@yeonsung\.ac\.kr$/i.test(email.trim());
}
