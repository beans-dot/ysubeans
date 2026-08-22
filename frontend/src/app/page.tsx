'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Settings,
} from 'lucide-react';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuthStore } from '@/store/useAuthStore';
import type { UserRole } from '@/lib/auth';

type HubItem = {
  href: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const HUB_ITEMS: HubItem[] = [
  {
    href: '/dashboard',
    title: '대학정보공시 데이터 검색 및 조회',
    description:
      '대상/지표를 선택하고 다년도 추이를 하이브리드 차트와 피벗 그리드로 기초 분석을 합니다.\n대학정보공시 API 데이터를 연계하여 활용하여 대학 단위로만 비교가 가능합니다.',
    icon: BarChart3,
    roles: ['admin', 'user'],
  },
  {
    href: '/competitiveness',
    title: '학과별 자체 경쟁력 분석 지표',
    description:
      '대상/지표를 선택하고 다년도 추이를 하이브리드 차트와 피벗 그리드로 기초 분석을 합니다.\n우리대학 내부 데이터를 활용하여 계열, 학과별 비교가 가능합니다.',
    icon: Building2,
    roles: ['admin', 'user'],
  },
  {
    href: '/monitoring',
    title: '대학 주요 현황 모니터링',
    description:
      '대학의 핵심지표만을 추려 현황을 한 눈에 볼 수 있도록 하는 대쉬보드입니다.',
    icon: LayoutDashboard,
    roles: ['admin', 'user'],
  },
  {
    href: '/strategic-plan',
    title: '중장기발전계획 성과관리',
    description:
      '대학 중장기발전계획 및 이에 연계된 성과지표, 예산 등을 관리합니다.',
    icon: ClipboardList,
    roles: ['admin', 'user'],
  },
  {
    href: '/admin',
    title: '관리자',
    description: '지표 트리를 구성하고 자체 데이터를 엑셀로 업로드합니다.',
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 text-center">
        <h1 className="mb-3 text-4xl text-foreground">
          연성대학교 IR 대시보드
        </h1>
        <p className="text-lg text-muted-foreground">
          이용할 메뉴를 선택하세요.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="block h-full">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <Icon className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="flex items-start gap-2 text-base leading-snug">
                    <span className="flex-1">{item.title}</span>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
                  </CardTitle>
                  <CardDescription className="whitespace-pre-line">
                    {item.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <MenuHub />
    </AuthGuard>
  );
}
