'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType } from 'react';
import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';

type HubItem = {
  href: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
};

const HUB_ITEMS: HubItem[] = [
  {
    href: '/dashboard',
    title: '대학정보공시 데이터 검색 및 조회',
    icon: BarChart3,
  },
  {
    href: '/competitiveness',
    title: '학과별 자체 경쟁력 분석 지표',
    icon: Building2,
  },
  {
    href: '/monitoring',
    title: '대학 주요 현황 모니터링',
    icon: LayoutDashboard,
  },
  {
    href: '/strategic-plan',
    title: '중장기발전계획 성과관리',
    icon: ClipboardList,
  },
];

function MenuHub() {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-start justify-center overflow-hidden pt-[12vh] sm:pt-[14vh]">
      <Image
        src="/campus-hero.jpg"
        alt="연성대학교 전경"
        fill
        priority
        quality={100}
        unoptimized
        sizes="100vw"
        className="object-cover object-center"
      />

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center px-4 sm:px-8">
        <h1 className="text-center text-4xl tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)] [-webkit-text-stroke:2px_#3f3f46] [paint-order:stroke_fill] sm:text-5xl sm:[-webkit-text-stroke:2.5px_#3f3f46] md:text-[3.25rem] md:[-webkit-text-stroke:3px_#3f3f46]">
          YSU IR Library
        </h1>
        <p className="mt-3 text-center text-[16px] tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          Yeonsung University Institutional Research Library
        </p>

        <nav
          aria-label="바로가기"
          className="mt-28 grid w-full grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/30 bg-white/30 lg:grid-cols-4"
        >
          {HUB_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[7.5rem] flex-col items-center justify-center gap-3 bg-black/50 px-3 py-5 text-center text-white transition-colors hover:bg-black/40"
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
