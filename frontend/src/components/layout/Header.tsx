'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { Ticker } from './Ticker';

const NAV: Array<{ href: string; label: string; roles: UserRole[] }> = [
  { href: '/dashboard', label: '대시보드', roles: ['admin', 'user'] },
  { href: '/admin', label: '관리자', roles: ['admin'] },
  {
    href: '/update-history',
    label: '업데이트 이력',
    roles: ['admin', 'user'],
  },
  {
    href: '/profile',
    label: '회원정보관리',
    roles: ['admin', 'user'],
  },
];

export function Header() {
  const pathname = usePathname();
  const { user, hydrated, hydrate, logout } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (pathname === '/login' || pathname === '/signup' || pathname === '/find-account') {
    return null;
  }

  const role = user?.role;
  const homeHref = role === 'admin' ? '/' : '/dashboard';
  const visibleNav = role
    ? NAV.filter((item) => item.roles.includes(role))
    : [];

  const onLogout = async () => {
    await logout();
    // Hard navigate so middleware sees cleared cookies and soft-nav races are avoided
    window.location.assign('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="flex h-16 min-w-0 items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href={homeHref}
          className="flex min-w-0 max-w-[40%] shrink items-center gap-2 sm:max-w-none sm:shrink-0 sm:gap-3"
        >
          <div className="relative h-8 w-[5.5rem] shrink-0 sm:h-9 sm:w-[6.15rem]">
            <Image
              src="/logo.png"
              alt="연성대학교"
              fill
              sizes="(max-width: 640px) 88px, 99px"
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <span className="font-emphasis truncate text-sm text-foreground sm:text-base">
            YSU IR Library
          </span>
        </Link>

        {hydrated && user && (
          <>
            {/* 티커가 가장 먼저 줄어들도록 flex-1 + min-w-0 */}
            <div className="mx-1 flex min-w-0 flex-1 basis-0 justify-center overflow-hidden sm:mx-4">
              <div className="w-full min-w-0 max-w-2xl">
                <Ticker />
              </div>
            </div>

            <nav className="relative z-10 flex shrink-0 items-center gap-0.5 sm:gap-1">
              {visibleNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-2 py-2 text-sm font-bold transition-colors hover:bg-accent sm:px-3',
                    pathname?.startsWith(item.href)
                      ? 'text-primary'
                      : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <span className="mx-1 hidden text-sm text-muted-foreground lg:inline">
                {user.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="gap-1 px-2 sm:px-3"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </Button>
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
