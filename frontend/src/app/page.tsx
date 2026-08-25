'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType } from 'react';
import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Settings,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuthStore } from '@/store/useAuthStore';
import type { UserRole } from '@/lib/auth';
import { cn } from '@/lib/utils';

type HubItem = {
  href: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const HUB_ITEMS: HubItem[] = [
  {
    href: '/dashboard',
    title: '대학정보공시 데이터 검색 및 조회',
    icon: BarChart3,
    roles: ['admin', 'user'],
  },
  {
    href: '/competitiveness',
    title: '학과별 자체 경쟁력 분석 지표',
    icon: Building2,
    roles: ['admin', 'user'],
  },
  {
    href: '/monitoring',
    title: '대학 주요 현황 모니터링',
    icon: LayoutDashboard,
    roles: ['admin', 'user'],
  },
  {
    href: '/strategic-plan',
    title: '중장기발전계획 성과관리',
    icon: ClipboardList,
    roles: ['admin', 'user'],
  },
  {
    href: '/admin',
    title: '관리자',
    icon: Settings,
    roles: ['admin'],
  },
];

function MenuHub() {
  const { user } = useAuthStore();
  const role = user?.role;
  const visibleItems = role
    ? HUB_ITEMS.filter((item) => item.roles.includes(role))
    : [];
  const cols = visibleItems.length >= 5 ? 5 : 4;

  return (
    <section className="relative -mt-16 flex min-h-screen items-center justify-center overflow-hidden">
      <Image
        src="/campus-hero.jpg"
        alt="연성대학교 전경"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[62%_42%] brightness-[0.45]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/60"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.45) 0.6px, transparent 0.6px)',
          backgroundSize: '3px 3px',
        }}
      />

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center px-4 pb-10 pt-24 sm:px-8">
        <h1 className="text-center text-4xl tracking-wide text-white drop-shadow-md sm:text-5xl md:text-[3.25rem]">
          연성대학교 IR 대시보드
        </h1>

        <nav
          aria-label="바로가기"
          className={cn(
            'mt-14 grid w-full gap-px overflow-hidden rounded-sm border border-white/25 bg-white/25',
            cols === 5
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
              : 'grid-cols-2 lg:grid-cols-4',
          )}
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[7.5rem] flex-col items-center justify-center gap-3 bg-black/35 px-3 py-5 text-center text-white transition-colors hover:bg-black/15"
              >
                <Icon className="h-6 w-6 shrink-0 opacity-90" />
                <span className="text-sm font-medium leading-snug sm:text-[0.95rem]">
                  {item.title}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <MenuHub />
    </AuthGuard>
  );
}
