'use client';

import { useEffect, useState } from 'react';
import { notifyAutoSaved } from '@/components/admin/AutoSaveToast';
import { SpCodeBadge, spCodeLevelFromKind } from '@/components/strategic-plan/SpCodeBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchSpChanges, rollbackSpChange } from '@/lib/strategic-plan/api';
import { apiMessage } from '@/lib/strategic-plan/apiError';
import type { SpChangeLog } from '@/lib/strategic-plan/types';

function payloadText(value: Record<string, unknown> | null) {
  if (!value) return '없음';
  return JSON.stringify(value, null, 2);
}

export function PlanChangeLogManager({
  reload,
}: {
  reload: () => Promise<void>;
}) {
  const [rows, setRows] = useState<SpChangeLog[]>([]);
  const [open, setOpen] = useState<SpChangeLog | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchSpChanges()
      .then(setRows)
      .catch(() => setRows([]));
  };

  useEffect(load, []);

  const rollback = async (row: SpChangeLog) => {
    const ok = window.confirm(
      `${row.year}학년도 ${row.displayCode} 변경을 되돌릴까요?`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await rollbackSpChange(row.logId);
      await reload();
      load();
      notifyAutoSaved();
      setOpen(null);
    } catch (e) {
      alert(apiMessage(e, '롤백 실패'));
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
          관리자가 바꾼 전략·KPI·재원을 학년도·위계·내역으로 확인합니다. 행을 누르면
          세부 내용과 롤백을 할 수 있습니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs">
              <tr>
                <th className="px-2 py-2 text-left font-bold">변경 기준년도</th>
                <th className="px-2 py-2 text-left font-bold">변경 위계</th>
                <th className="px-2 py-2 text-left font-bold">코드</th>
                <th className="px-2 py-2 text-left font-bold">변경 내역</th>
                <th className="px-2 py-2 text-left font-bold">요약</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.logId}
                  className="cursor-pointer border-b hover:bg-accent/40"
                  onClick={() => setOpen(row)}
                >
                  <td className="px-2 py-1.5 text-left">{row.year}</td>
                  <td className="px-2 py-1.5 text-left">{row.kindLabel}</td>
                  <td className="px-2 py-1.5 text-left">
                    <SpCodeBadge level={spCodeLevelFromKind(row.kind)}>
                      {row.displayCode}
                    </SpCodeBadge>
                  </td>
                  <td className="px-2 py-1.5 text-left">{row.changeTypeLabel}</td>
                  <td className="px-2 py-1.5 text-left">{row.summary}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    변경이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {open?.year} {open?.kindLabel} {open?.changeTypeLabel}
            </DialogTitle>
            <DialogDescription>{open?.summary}</DialogDescription>
          </DialogHeader>
          {open && (
            <div className="grid gap-3 text-xs">
              <div>
                <p className="mb-1 font-bold">변경 전</p>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-2">
                  {payloadText(open.beforePayload)}
                </pre>
              </div>
              <div>
                <p className="mb-1 font-bold">변경 후</p>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-2">
                  {payloadText(open.afterPayload)}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              닫기
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !open?.beforePayload}
              onClick={() => open && void rollback(open)}
            >
              롤백
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
