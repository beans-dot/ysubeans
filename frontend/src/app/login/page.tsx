'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { homePathForRole, useAuthStore } from '@/store/useAuthStore';

export default function LoginPage() {
  const router = useRouter();
  const { user, hydrated, hydrate, login } = useAuthStore();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && user) {
      router.replace(homePathForRole(user.role));
    }
  }, [hydrated, user, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await login(id, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace(homePathForRole(result.user.role));
  };

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="relative mx-auto h-12 w-[8.25rem] sm:h-14 sm:w-[9.6rem]">
            <Image
              src="/logo.png"
              alt="연성대학교"
              fill
              sizes="(max-width: 640px) 132px, 154px"
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <div>
            <CardTitle className="text-2xl">로그인</CardTitle>
            <CardDescription className="mt-2">
              연성대학교 IR 대시보드에 접속하려면 로그인하세요.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-id">아이디</Label>
              <Input
                id="login-id"
                autoComplete="username"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="아이디"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">비밀번호</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive whitespace-pre-line" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '로그인 중…' : '로그인'}
            </Button>
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <p>
                계정이 없으신가요?{' '}
                <Link
                  href="/signup"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  회원가입
                </Link>
              </p>
              <p>
                <Link
                  href="/find-account"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  아이디/비밀번호 찾기
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
