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
import { AffiliationFields } from '@/components/auth/AffiliationFields';
import {
  api,
  type AffiliationOptions,
  type AffiliationType,
} from '@/lib/api';
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

export default function SignupPage() {
  const router = useRouter();
  const { user, hydrated, hydrate } = useAuthStore();

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [affiliationType, setAffiliationType] = useState<
    AffiliationType | ''
  >('');
  const [department, setDepartment] = useState('');
  const [affiliationOptions, setAffiliationOptions] =
    useState<AffiliationOptions | null>(null);
  const [affiliationLoading, setAffiliationLoading] = useState(true);
  const [extension, setExtension] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAffiliationLoading(true);
      try {
        const { data } = await api.get<AffiliationOptions>(
          '/auth/affiliation-options',
        );
        if (!cancelled) setAffiliationOptions(data);
      } catch {
        if (!cancelled) {
          setError('소속 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setAffiliationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated && user) {
      router.replace(homePathForRole(user.role));
    }
  }, [hydrated, user, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isYeonsungEmail(email)) {
      setError('이메일은 yeonsung.ac.kr 도메인만 사용할 수 있습니다.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (!affiliationType) {
      setError('소속 유형을 선택해 주세요.');
      return;
    }
    if (!department.trim()) {
      setError('소속을 선택하거나 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/register', {
        id,
        name,
        email,
        password,
        passwordConfirm,
        affiliationType,
        department,
        extension,
      });
      setDoneOpen(true);
    } catch (err) {
      setError(apiErrorMessage(err, '회원가입 신청에 실패했습니다.'));
    } finally {
      setSubmitting(false);
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
            <CardTitle className="text-2xl">회원가입</CardTitle>
            <CardDescription className="mt-2">
              신청 후 관리자 승인이 완료되면 로그인할 수 있습니다.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-id">아이디</Label>
              <Input
                id="signup-id"
                autoComplete="username"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-name">성명</Label>
              <Input
                id="signup-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">이메일</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@yeonsung.ac.kr"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">비밀번호</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password-confirm">비밀번호 확인</Label>
              <Input
                id="signup-password-confirm"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </div>
            <AffiliationFields
              idPrefix="signup"
              affiliationType={affiliationType}
              department={department}
              options={affiliationOptions}
              loading={affiliationLoading}
              onAffiliationTypeChange={setAffiliationType}
              onDepartmentChange={setDepartment}
            />
            <div className="space-y-2">
              <Label htmlFor="signup-extension">내선번호</Label>
              <Input
                id="signup-extension"
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                required
              />
            </div>

            {error && (
              <p
                className="text-sm text-destructive whitespace-pre-line"
                role="alert"
              >
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '신청 중…' : '회원가입 신청'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{' '}
              <Link
                href="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                로그인
              </Link>
            </p>

            <p className="text-center text-sm font-medium text-red-600">
              ※ 본 페이지는 대학내 주요 데이터를 관리하고 있기 때문에 외부로의
              유출을 절대 금해주시기 바랍니다.
            </p>
          </form>
        </CardContent>
      </Card>

      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>회원가입 신청 완료</DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-left text-foreground">
              회원가입을 신청해주셔서 감사합니다.
              <br />
              관리자 승인 이후 사용이 가능합니다.
              <br />※ 문의 : 연성대학교 기획처 IR센터
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setDoneOpen(false);
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
