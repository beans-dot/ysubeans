'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import axios from 'axios';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { homePathForRole, isYeonsungEmail } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg) && msg.length > 0) return msg.join('\n');
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export default function FindAccountPage() {
  const router = useRouter();
  const { user, hydrated, hydrate } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [foundId, setFoundId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'id' | 'pw' | null>(null);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && user) {
      router.replace(homePathForRole(user.role));
    }
  }, [hydrated, user, router]);

  const validate = () => {
    if (!name.trim()) {
      setError('성명을 입력해 주세요.');
      return false;
    }
    if (!isYeonsungEmail(email)) {
      setError('이메일은 yeonsung.ac.kr 도메인만 사용할 수 있습니다.');
      return false;
    }
    return true;
  };

  const onFindId = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFoundId(null);
    if (!validate()) return;

    setBusy('id');
    try {
      const { data } = await api.post<{ id: string }>('/auth/find-id', {
        name: name.trim(),
        email: email.trim(),
      });
      setFoundId(data.id);
    } catch (err) {
      setError(apiErrorMessage(err, '일치하는 회원 정보가 없습니다.'));
    } finally {
      setBusy(null);
    }
  };

  const onFindPassword = async () => {
    setError(null);
    if (!validate()) return;

    setBusy('pw');
    try {
      await api.post('/auth/reset-password', {
        name: name.trim(),
        email: email.trim(),
      });
      setPwDialogOpen(true);
    } catch (err) {
      setError(apiErrorMessage(err, '비밀번호 재설정에 실패했습니다.'));
    } finally {
      setBusy(null);
    }
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
            <CardTitle className="text-2xl">아이디/비밀번호 찾기</CardTitle>
            <CardDescription className="mt-2">
              성명과 가입 이메일로 아이디를 확인하거나 임시 비밀번호를 받을 수
              있습니다.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onFindId} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="find-name">성명</Label>
              <Input
                id="find-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="find-email">이메일</Label>
              <Input
                id="find-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@yeonsung.ac.kr"
                required
              />
            </div>

            {foundId && (
              <div className="rounded-md border bg-muted/40 px-3 py-3 text-sm">
                회원 아이디:{' '}
                <span className="font-bold text-foreground">{foundId}</span>
              </div>
            )}

            {error && (
              <p
                className="text-sm text-destructive whitespace-pre-line"
                role="alert"
              >
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy != null}>
              {busy === 'id' ? '조회 중…' : '아이디 찾기'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy != null}
              onClick={() => void onFindPassword()}
            >
              {busy === 'pw' ? '발송 중…' : '비밀번호 찾기'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                로그인으로 돌아가기
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>임시 비밀번호 발급</DialogTitle>
            <DialogDescription className="text-foreground">
              가입하신 이메일로 임시 비밀번호가 발급되었습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setPwDialogOpen(false);
                router.push('/login');
              }}
            >
              로그인 화면으로
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
