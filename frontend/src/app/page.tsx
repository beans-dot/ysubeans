'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BarChart3, Settings } from 'lucide-react';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuthStore } from '@/store/useAuthStore';

function AdminHome() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-12 text-center">
        <h1 className="mb-3 text-4xl text-foreground">
          연성대학교 IR 대시보드
        </h1>
        <p className="text-lg text-muted-foreground">
          이용할 메뉴를 선택하세요.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/dashboard">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <BarChart3 className="mb-2 h-8 w-8 text-primary" />
              <CardTitle className="flex items-center gap-2">
                대시보드 <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>
                대상/지표를 선택하고 다년도 추이를 하이브리드 차트와 피벗
                그리드로 분석합니다.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <Settings className="mb-2 h-8 w-8 text-primary" />
              <CardTitle className="flex items-center gap-2">
                관리자 <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>
                지표 트리를 구성하고 자체 데이터를 엑셀로 업로드합니다.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && user?.role === 'user') {
      router.replace('/dashboard');
    }
  }, [hydrated, user, router]);

  return (
    <AuthGuard>
      <AdminHome />
    </AuthGuard>
  );
}
