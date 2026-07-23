'use client';

import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthGuard } from '@/components/auth/AuthGuard';
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
import { api } from '@/lib/api';
import { isYeonsungEmail, setSessionCookie, type AuthUser } from '@/lib/auth';
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

type Profile = {
  id: string;
  name: string;
  role: AuthUser['role'];
  email: string;
  department: string;
  extension: string;
};

export default function ProfilePage() {
  const { user, hydrate } = useAuthStore();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [extension, setExtension] = useState('');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<Profile>('/auth/me');
        if (cancelled) return;
        setProfile(data);
        setName(data.name);
        setEmail(data.email);
        setDepartment(data.department);
        setExtension(data.extension);
      } catch (err) {
        if (!cancelled) {
          setProfileError(
            apiErrorMessage(err, '회원 정보를 불러오지 못했습니다.'),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileError(null);

    if (!isYeonsungEmail(email)) {
      setProfileError('이메일은 yeonsung.ac.kr 도메인만 사용할 수 있습니다.');
      return;
    }

    setProfileBusy(true);
    try {
      const { data } = await api.patch<Profile>('/auth/me', {
        name,
        email,
        department,
        extension,
      });
      setProfile(data);
      if (user) {
        const next: AuthUser = {
          id: data.id,
          name: data.name,
          role: data.role,
        };
        setSessionCookie(next);
        useAuthStore.setState({ user: next });
      }
      setProfileMsg('회원 정보가 저장되었습니다.');
    } catch (err) {
      setProfileError(apiErrorMessage(err, '회원 정보 저장에 실패했습니다.'));
    } finally {
      setProfileBusy(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setPwError(null);

    if (newPassword !== newPasswordConfirm) {
      setPwError('신규 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('신규 비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setPwBusy(true);
    try {
      const { data } = await api.post<{ message: string }>(
        '/auth/change-password',
        {
          currentPassword,
          newPassword,
          newPasswordConfirm,
        },
      );
      setPwMsg(data.message || '비밀번호가 변경되었습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      setPwError(apiErrorMessage(err, '비밀번호 변경에 실패했습니다.'));
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <AuthGuard>
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold">회원정보관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            아이디를 제외한 정보와 비밀번호를 변경할 수 있습니다.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>기본 정보</CardTitle>
                <CardDescription>
                  아이디는 변경할 수 없습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSaveProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-id">아이디</Label>
                    <Input
                      id="profile-id"
                      value={profile?.id || ''}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">성명</Label>
                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email">이메일</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-department">소속부서</Label>
                    <Input
                      id="profile-department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-extension">내선번호</Label>
                    <Input
                      id="profile-extension"
                      value={extension}
                      onChange={(e) => setExtension(e.target.value)}
                      required
                    />
                  </div>

                  {profileError && (
                    <p className="text-sm text-destructive whitespace-pre-line">
                      {profileError}
                    </p>
                  )}
                  {profileMsg && (
                    <p className="text-sm text-muted-foreground">{profileMsg}</p>
                  )}

                  <Button type="submit" disabled={profileBusy}>
                    {profileBusy ? '저장 중…' : '정보 저장'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>비밀번호 변경</CardTitle>
                <CardDescription>
                  현재 비밀번호 확인 후 새 비밀번호로 변경합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">현재 비밀번호</Label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">신규 비밀번호</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password-confirm">
                      신규 비밀번호 확인
                    </Label>
                    <Input
                      id="new-password-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      required
                    />
                  </div>

                  {pwError && (
                    <p className="text-sm text-destructive whitespace-pre-line">
                      {pwError}
                    </p>
                  )}
                  {pwMsg && (
                    <p className="text-sm text-muted-foreground">{pwMsg}</p>
                  )}

                  <Button type="submit" disabled={pwBusy}>
                    {pwBusy ? '변경 중…' : '비밀번호 변경'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AuthGuard>
  );
}
