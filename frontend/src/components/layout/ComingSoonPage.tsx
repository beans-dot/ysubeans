'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';

export function ComingSoonPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AuthGuard>
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <h1 className="mb-3 text-3xl text-foreground">{title}</h1>
        <p className="mb-2 whitespace-pre-line text-muted-foreground">
          {description}
        </p>
        <p className="mb-8 text-sm text-muted-foreground">
          이 화면은 준비 중입니다. 곧 상세 설계를 진행합니다.
        </p>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            메뉴로 돌아가기
          </Link>
        </Button>
      </div>
    </AuthGuard>
  );
}
