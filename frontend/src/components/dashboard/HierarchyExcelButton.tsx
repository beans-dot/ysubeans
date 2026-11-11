'use client';

import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { PivotResult } from '@/lib/api';
import {
  fetchExpandedPivot,
  selectionHasSubHierarchy,
  type HierarchyExportTarget,
} from '@/lib/hierarchyExport';
import { cn } from '@/lib/utils';
import { useAnalysisStore } from '@/store/AnalysisStoreProvider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ExportScope = 'average' | 'descendants';

export function HierarchyExcelButton({
  disabled,
  className,
  onAverage,
  onDescendants,
}: {
  disabled?: boolean;
  className?: string;
  /** 화면에 조회된 평균(또는 최하위) 그대로 */
  onAverage: () => void;
  /** 하위 위계를 다시 조회한 피벗 */
  onDescendants: (result: {
    pivot: PivotResult;
    targets: HierarchyExportTarget[];
  }) => void;
}) {
  const targetTree = useAnalysisStore((s) => s.targetTree);
  const selectedTargets = useAnalysisStore((s) => s.selectedTargets);
  const selectedMetrics = useAnalysisStore((s) => s.selectedMetrics);
  const years = useAnalysisStore((s) => s.years);

  const needsChoice = useMemo(
    () => selectionHasSubHierarchy(targetTree, selectedTargets),
    [targetTree, selectedTargets],
  );

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ExportScope>('average');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setScope('average');
    setError(null);
    setOpen(true);
  };

  const confirm = async () => {
    if (scope === 'average') {
      setOpen(false);
      onAverage();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await fetchExpandedPivot({
        tree: targetTree,
        selected: selectedTargets,
        metricIds: selectedMetrics.map((metric) => metric.metricId),
        years,
      });
      if (result.pivot.rows.length === 0) {
        setError('하위 위계에서 값이 있는 데이터가 없습니다.');
        return;
      }
      onDescendants(result);
      setOpen(false);
    } catch {
      setError('하위 위계 데이터를 받지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={className}
        disabled={disabled || busy}
        onClick={() => {
          if (needsChoice) openDialog();
          else onAverage();
        }}
      >
        <FileSpreadsheet className="mr-1 h-4 w-4" /> 엑셀 다운로드
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>엑셀로 받을 범위</DialogTitle>
            <DialogDescription>
              선택한 위계 아래에 또 위계가 있습니다. 그 위계의 평균만 받을지,
              아래 위계를 모두 받을지 고르세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border p-3',
                scope === 'average' && 'border-primary bg-primary/5',
              )}
            >
              <input
                type="radio"
                name="hierarchy-xlsx-scope"
                className="mt-1"
                checked={scope === 'average'}
                onChange={() => setScope('average')}
              />
              <span>
                <span className="font-bold">선택한 위계의 평균만</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  지금 화면에 조회된 값만 받습니다.
                </span>
              </span>
            </label>
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border p-3',
                scope === 'descendants' && 'border-primary bg-primary/5',
              )}
            >
              <input
                type="radio"
                name="hierarchy-xlsx-scope"
                className="mt-1"
                checked={scope === 'descendants'}
                onChange={() => setScope('descendants')}
              />
              <span>
                <span className="font-bold">하위 위계 전체</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  선택한 위계를 이루는 아래 단계를 모두 받습니다. 전문대학이면
                  수도권·비수도권, 서울·경기·인천, 대학이 함께 나오고, 계열이면
                  소속 학과가 나옵니다.
                </span>
              </span>
            </label>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="button" disabled={busy} onClick={() => void confirm()}>
              {busy ? '받는 중...' : '다운로드'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
