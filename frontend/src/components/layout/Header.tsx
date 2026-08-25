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

  const isHome = pathname === '/';
  const role = user?.role;
  const homeHref = '/';
  const visibleNav = role
    ? NAV.filter((item) => item.roles.includes(role))
    : [];

  const onLogout = async () => {
    await logout();
    // Hard navigate so middleware sees cleared cookies and soft-nav races are avoided
    window.location.assign('/login');
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full',
        isHome
          ? 'border-b border-white/10 bg-black/30 backdrop-blur-sm'
          : 'border-b bg-background/95 backdrop-blur',
      )}
    >
      <div className="flex h-16 min-w-0 items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href={homeHref}
          className="flex min-w-0 max-w-[70%] shrink items-center gap-4 sm:max-w-none sm:shrink-0 sm:gap-6"
        >
          <div
            className={cn(
              'shrink-0',
              isHome && 'rounded-md bg-white/95 px-1.5 py-0.5',
            )}
          >
            <div className="relative h-[34px] w-[154px] sm:h-[39px] sm:w-[177px]">
              <Image
                src="/logo.png"
                alt="연성대학교"
                fill
                sizes="(max-width: 640px) 154px, 177px"
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          <span
            className={cn(
              'font-emphasis truncate text-[1.05rem] sm:text-[1.2rem]',
              isHome ? 'text-white' : 'text-foreground',
            )}
          >
            YSU IR Library
          </span>
        </Link>

        {hydrated && user && (
          <>
            {!isHome && (
              <div className="mx-1 flex min-w-0 flex-1 basis-0 justify-center overflow-hidden sm:mx-4">
                <div className="w-full min-w-0 max-w-2xl">
                  <Ticker />
                </div>
              </div>
            )}
            {isHome && <div className="min-w-0 flex-1" />}

            <nav className="relative z-10 flex shrink-0 items-center gap-0.5 sm:gap-1">
              {visibleNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-2 py-2 text-sm font-bold transition-colors sm:px-3',
                    isHome
                      ? pathname === item.href
                        ? 'bg-white/15 text-white'
                        : 'text-white/90 hover:bg-white/10 hover:text-white'
                      : pathname?.startsWith(item.href)
                        ? 'text-primary hover:bg-accent'
                        : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <span
                className={cn(
                  'mx-1 hidden text-sm font-bold lg:inline',
                  isHome ? 'text-white' : 'text-blue-900',
                )}
              >
                {user.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className={cn(
                  'gap-1 px-2 sm:px-3',
                  isHome &&
                    'text-white hover:bg-white/10 hover:text-white',
                )}
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
