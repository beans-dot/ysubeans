'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface BatchLog {
  logId: number;
  updateDate: string;
  updateType: string;
  logText: string;
}

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

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ko-KR');
  } catch {
    return value;
  }
}

export function AlimiBatchManager() {
  const [logs, setLogs] = useState<BatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<BatchLog[]>('/alimi/batches');
      setLogs(data);
    } catch (err) {
      setError(apiErrorMessage(err, '배치 기록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runBatch = async () => {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const { data } = await api.post<{ year: number; upserted: number }>(
        '/alimi/batch',
        undefined,
        { timeout: 600000 },
      );
      setMsg(`정기 배치 완료: ${data.year}년, ${data.upserted}건 반영`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, '배치 실행 실패 (백엔드/API 키 확인)'));
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">대학알리미 API 배치</h2>
          <p className="text-sm text-muted-foreground">
            당해 연도 공시 데이터를 가져와 반영합니다. 실행 기록은 아래에
            남습니다.
          </p>
        </div>
        <Button onClick={() => void runBatch()} disabled={busy}>
          <RefreshCw className={`mr-1 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          {busy ? '배치 실행 중…' : '배치 실행'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : logs.length === 0 ? (
        <p className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          아직 배치 기록이 없습니다.
        </p>
      ) : (
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 font-bold">시각</th>
                <th className="px-3 py-2 font-bold">내용</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.logId} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(log.updateDate)}
                  </td>
                  <td className="px-3 py-2">{log.logText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
