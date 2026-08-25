'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, type MemberSummary } from '@/lib/api';

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg) && msg.length > 0) return msg.join('\n');
    if (typeof msg === 'string' && msg.trim()) return msg;
    return fallback;
  }
  return fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ko-KR');
  } catch {
    return value;
  }
}

export function SignupApproval() {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<MemberSummary[]>('/users', {
        params: { status: 'pending' },
      });
      setMembers(data);
    } catch (err) {
      setError(apiErrorMessage(err, '신청 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string) => {
    setBusyId(id);
    setMsg(null);
    try {
      await api.post(`/users/${encodeURIComponent(id)}/approve`);
      setMsg('회원을 승인했습니다.');
      await load();
    } catch (err) {
      setMsg(apiErrorMessage(err, '승인에 실패했습니다.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">회원가입 승인</h2>
          <p className="text-sm text-muted-foreground">
            신규 신청자를 확인하고 회원으로 받아들입니다.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          새로고침
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{msg}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : members.length === 0 ? (
        <p className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          회원가입 신규 신청자가 없습니다.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {m.id} - {m.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {m.email} · 신청 {formatDate(m.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">승인 대기</Badge>
                <Button
                  size="sm"
                  disabled={busyId === m.id}
                  onClick={() => void approve(m.id)}
                >
                  승인
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
