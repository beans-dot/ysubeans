'use client';

import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

export interface OrgChangeLog {
  logId: number;
  year: number;
  kind: string;
  kindLabel: string;
  lineageId: string;
  displayName: string;
  changeType: string;
  changeTypeLabel: string;
  summary: string;
  beforePayload: Record<string, unknown> | null;
  afterPayload: Record<string, unknown> | null;
  changedBy: string | null;
  createdAt: string;
}

export function OrgChangeLogManager({
  refreshKey,
  onRolledBack,
}: {
  refreshKey: number;
  onRolledBack?: () => void;
}) {
  const [rows, setRows] = useState<OrgChangeLog[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api
      .get<OrgChangeLog[]>('/internal-org/changes')
      .then(({ data }) => setRows(data))
      .catch(() => setRows([]));
  };

  useEffect(load, [refreshKey]);

  const rollback = async (row: OrgChangeLog) => {
    const ok = window.confirm(
      `${row.year}학년도 「${row.displayName}」 변경을 되돌릴까요?`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(`/internal-org/changes/${row.logId}/rollback`);
      load();
      onRolledBack?.();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '롤백 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>변경이력</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          조직관리에서 바꾼 계열·학과·행정부서를 학년도별로 확인하고 롤백할 수
          있습니다. 연간 변동사항 [연성대학교] 한 행에 [학과]/[행정부서]로
          이어 붙습니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs">
              <tr>
                <th className="px-2 py-2 text-left font-bold">적용 학년도</th>
                <th className="px-2 py-2 text-left font-bold">구분</th>
                <th className="px-2 py-2 text-left font-bold">내역</th>
                <th className="px-2 py-2 text-left font-bold">요약</th>
                <th className="px-2 py-2 text-right font-bold">롤백</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.logId} className="border-b last:border-0">
                  <td className="px-2 py-2">{row.year}</td>
                  <td className="px-2 py-2">{row.kindLabel}</td>
                  <td className="px-2 py-2">{row.changeTypeLabel}</td>
                  <td className="px-2 py-2">{row.summary}</td>
                  <td className="px-2 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      disabled={busy || !row.beforePayload}
                      onClick={() => void rollback(row)}
                      title="롤백"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    변경이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
