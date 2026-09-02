'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/strategic-plan/ui';
import type { SpFullRevision, SpFullRevisionScope } from '@/lib/strategic-plan/types';

const SCOPE_LABEL: Record<SpFullRevisionScope, string> = {
  structure: '전략체계',
  kpi: 'KPI',
  fund: '재원 유형',
};

export function FullRevisionBar({
  scope,
  years,
  viewYear,
  revisions,
  busy,
  onRevise,
  onViewRevision,
  onViewCurrent,
}: {
  scope: SpFullRevisionScope;
  years: number[];
  viewYear: number | null;
  revisions: SpFullRevision[];
  busy?: boolean;
  onRevise: (year: number) => Promise<void>;
  onViewRevision: (snapshotYear: number) => void;
  onViewCurrent: () => void;
}) {
  const defaultYear = years[years.length - 1] ?? new Date().getFullYear();
  const [reviseOpen, setReviseOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [year, setYear] = useState(defaultYear);

  const snapshots = useMemo(() => {
    const seen = new Set<number>();
    const items: Array<{ snapshotYear: number; year: number }> = [];
    for (const row of revisions) {
      if (seen.has(row.snapshotYear)) continue;
      seen.add(row.snapshotYear);
      items.push({ snapshotYear: row.snapshotYear, year: row.year });
    }
    return items.sort((a, b) => b.snapshotYear - a.snapshotYear);
  }, [revisions]);

  const submitRevise = async () => {
    await onRevise(year);
    setReviseOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {viewYear != null && (
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={busy}
          onClick={onViewCurrent}
        >
          현 시점 조회
        </Button>
      )}
      {viewYear == null && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setYear(defaultYear);
            setReviseOpen(true);
          }}
        >
          전면개정
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setLookupOpen(true)}
      >
        전면개정 조회
      </Button>

      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{SCOPE_LABEL[scope]} 전면개정</DialogTitle>
            <DialogDescription>
              선택한 학년도부터 {SCOPE_LABEL[scope]}를 공란으로 만듭니다. 그 이전
              학년도 데이터는 그대로 두고, 전면개정 조회로 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label className="text-left">적용 학년도</Label>
            <NativeSelect
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}학년도부터
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              {year}학년도부터 적용하면 {year - 1}학년도까지는 기존 내용이 유지됩니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviseOpen(false)}>
              취소
            </Button>
            <Button
              disabled={busy}
              onClick={() => void submitRevise()}
            >
              전면개정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>전면개정 조회</DialogTitle>
            <DialogDescription>
              공란으로 바뀌기 직전 시점을 고르면 그 학년도의 전략체계·KPI·재원
              유형을 볼 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                저장된 전면개정이 없습니다.
              </p>
            ) : (
              snapshots.map((item) => (
                <Button
                  key={item.snapshotYear}
                  type="button"
                  variant={
                    viewYear === item.snapshotYear ? 'default' : 'outline'
                  }
                  onClick={() => {
                    onViewRevision(item.snapshotYear);
                    setLookupOpen(false);
                  }}
                >
                  {item.snapshotYear}학년도 전면개정
                </Button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLookupOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
