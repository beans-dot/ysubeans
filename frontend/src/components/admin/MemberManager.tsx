'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  api,
  type LoginLogEntry,
  type MemberStatus,
  type MemberSummary,
} from '@/lib/api';

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

const STATUS_LABEL: Record<MemberStatus, string> = {
  pending: '승인 대기',
  approved: '승인',
  rejected: '거절',
};

function statusVariant(
  status: MemberStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'pending') return 'secondary';
  if (status === 'approved') return 'default';
  return 'destructive';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ko-KR');
  } catch {
    return value;
  }
}

export function MemberManager() {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<MemberSummary | null>(null);
  const [loginLogs, setLoginLogs] = useState<LoginLogEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<MemberSummary[]>('/users');
      setMembers(data);
    } catch (err) {
      setError(apiErrorMessage(err, '회원 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setMsg(null);
    try {
      const { data } = await api.get<{
        user: MemberSummary;
        loginLogs: LoginLogEntry[];
      }>(`/users/${encodeURIComponent(id)}`);
      setDetailUser(data.user);
      setLoginLogs(data.loginLogs);
    } catch (err) {
      setMsg(apiErrorMessage(err, '회원 정보를 불러오지 못했습니다.'));
      setDetailUser(null);
      setLoginLogs([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetailUser(null);
    setLoginLogs([]);
  };

  const runAction = async (
    id: string,
    action: 'approve' | 'reject' | 'reset-password',
  ) => {
    setBusyId(id);
    setMsg(null);
    try {
      const { data } = await api.post(`/users/${encodeURIComponent(id)}/${action}`);
      if (action === 'reset-password') {
        setMsg(
          (data as { message?: string }).message ||
            '임시 비밀번호를 발송했습니다.',
        );
      } else {
        setMsg(
          action === 'approve'
            ? '회원을 승인했습니다.'
            : '회원가입 신청을 거절했습니다.',
        );
      }
      await loadMembers();
      if (selectedId === id) {
        await openDetail(id);
      }
    } catch (err) {
      setMsg(apiErrorMessage(err, '처리에 실패했습니다.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleWithdraw = async (member: MemberSummary) => {
    if (member.role === 'admin') {
      setMsg('관리자 계정은 탈퇴시킬 수 없습니다.');
      return;
    }
    const ok = window.confirm(
      `「${member.id} - ${member.name}」 회원을 탈퇴(삭제)할까요?\n이 작업은 되돌릴 수 없습니다.`,
    );
    if (!ok) return;

    setBusyId(member.id);
    setMsg(null);
    try {
      await api.delete(`/users/${encodeURIComponent(member.id)}`);
      setMsg('회원을 탈퇴(삭제) 처리했습니다.');
      if (selectedId === member.id) {
        closeDetail();
      }
      await loadMembers();
    } catch (err) {
      setMsg(apiErrorMessage(err, '회원 탈퇴 처리에 실패했습니다.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">회원관리</h2>
          <p className="text-sm text-muted-foreground">
            회원가입 대기 여부를 확인하고 승인·거절하거나, 회원을 탈퇴(삭제)할 수
            있습니다.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadMembers()} disabled={loading}>
          새로고침
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-muted-foreground whitespace-pre-line">{msg}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 회원이 없습니다.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <button
                type="button"
                className="text-left font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => void openDetail(m.id)}
              >
                {m.id} - {m.name}
              </button>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(m.status)}>
                  {STATUS_LABEL[m.status]}
                </Badge>
                {m.role === 'admin' && (
                  <Badge variant="outline">관리자</Badge>
                )}
                {m.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      disabled={busyId === m.id}
                      onClick={() => void runAction(m.id, 'approve')}
                    >
                      승인
                    </Button>
                    {m.role !== 'admin' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === m.id}
                        onClick={() => void handleWithdraw(m)}
                      >
                        회원탈퇴
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === m.id}
                      onClick={() => void runAction(m.id, 'reject')}
                    >
                      거절
                    </Button>
                  </>
                )}
                {m.status !== 'pending' && m.role !== 'admin' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busyId === m.id}
                    onClick={() => void handleWithdraw(m)}
                  >
                    회원탈퇴
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>회원 정보</DialogTitle>
          </DialogHeader>

          {detailLoading || !detailUser ? (
            <p className="text-sm text-muted-foreground">불러오는 중…</p>
          ) : (
            <div className="space-y-6">
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">아이디</dt>
                  <dd className="font-medium">{detailUser.id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">성명</dt>
                  <dd className="font-medium">{detailUser.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">이메일</dt>
                  <dd className="font-medium">{detailUser.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">소속부서</dt>
                  <dd className="font-medium">{detailUser.department}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">내선번호</dt>
                  <dd className="font-medium">{detailUser.extension}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">상태</dt>
                  <dd>
                    <Badge variant={statusVariant(detailUser.status)}>
                      {STATUS_LABEL[detailUser.status]}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">신청일시</dt>
                  <dd>{formatDate(detailUser.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">승인/처리</dt>
                  <dd>
                    {formatDate(detailUser.approvedAt)}
                    {detailUser.approvedBy
                      ? ` (by ${detailUser.approvedBy})`
                      : ''}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {detailUser.status === 'pending' && (
                  <>
                    <Button
                      disabled={busyId === detailUser.id}
                      onClick={() => void runAction(detailUser.id, 'approve')}
                    >
                      승인
                    </Button>
                    {detailUser.role !== 'admin' && (
                      <Button
                        variant="destructive"
                        disabled={busyId === detailUser.id}
                        onClick={() => void handleWithdraw(detailUser)}
                      >
                        회원탈퇴
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={busyId === detailUser.id}
                      onClick={() => void runAction(detailUser.id, 'reject')}
                    >
                      거절
                    </Button>
                  </>
                )}
                {detailUser.status === 'approved' && (
                  <Button
                    variant="outline"
                    disabled={busyId === detailUser.id}
                    onClick={() =>
                      void runAction(detailUser.id, 'reset-password')
                    }
                  >
                    임시 비밀번호 재설정
                  </Button>
                )}
                {detailUser.status !== 'pending' &&
                  detailUser.role !== 'admin' && (
                    <Button
                      variant="destructive"
                      disabled={busyId === detailUser.id}
                      onClick={() => void handleWithdraw(detailUser)}
                    >
                      회원탈퇴
                    </Button>
                  )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-bold">로그인 로그</h3>
                {loginLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    로그인 기록이 없습니다.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-auto rounded-md border">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="px-2 py-1.5">시각</th>
                          <th className="px-2 py-1.5">결과</th>
                          <th className="px-2 py-1.5">IP</th>
                          <th className="px-2 py-1.5">사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loginLogs.map((log) => (
                          <tr key={log.logId} className="border-t">
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </td>
                            <td className="px-2 py-1.5">
                              {log.success ? '성공' : '실패'}
                            </td>
                            <td className="px-2 py-1.5">{log.ip || '-'}</td>
                            <td className="px-2 py-1.5">
                              {log.failReason || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDetail}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
