'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Lock, X } from 'lucide-react';
import { api, type CategoryTreeNode } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/store/useDashboardStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function DualListboxModal() {
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [open, setOpen] = useState(false);

  const selectedMetrics = useDashboardStore((s) => s.selectedMetrics);
  const toggleMetric = useDashboardStore((s) => s.toggleMetric);
  const clearMetrics = useDashboardStore((s) => s.clearMetrics);
  const hasOther = useDashboardStore((s) => s.hasOtherUniversity)();

  useEffect(() => {
    if (open && tree.length === 0) {
      api
        .get<CategoryTreeNode[]>('/metrics/tree')
        .then(({ data }) => setTree(data))
        .catch(() => setTree([]));
    }
  }, [open, tree.length]);

  const isSelected = (metricId: number) =>
    selectedMetrics.some((m) => m.metricId === metricId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          지표 선택 ({selectedMetrics.length})
          <ChevronRight className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>지표 선택 (업무 주제별)</DialogTitle>
        </DialogHeader>

        {hasOther && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <Lock className="h-4 w-4" />
            타 대학이 선택되어 있어 <b>[자체]</b> 지표는 사용할 수 없습니다.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* 좌: 사용 가능 지표 (카테고리별) */}
          <div className="max-h-[50vh] overflow-y-auto rounded-md border p-3">
            <div className="mb-2 text-xs font-bold text-muted-foreground">
              사용 가능 지표
            </div>
            {tree.length === 0 && (
              <p className="text-sm text-muted-foreground">
                등록된 지표가 없습니다.
              </p>
            )}
            {tree.map((cat) => (
              <div key={cat.categoryId} className="mb-3">
                <div className="mb-1 text-sm font-bold text-foreground">
                  {cat.categoryName}
                </div>
                <div className="space-y-1">
                  {cat.metrics.map((m) => {
                    const disabled = hasOther && m.sourceType === 'INTERNAL';
                    const selected = isSelected(m.metricId);
                    return (
                      <span
                        key={m.metricId}
                        className="block"
                        title={
                          disabled
                            ? '연성대학교 자체 지표의 경우 타대학과의 비교가 불가합니다.'
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            toggleMetric({
                              metricId: m.metricId,
                              metricName: m.metricName,
                              sourceType: m.sourceType,
                              unit: m.metricUnit,
                            })
                          }
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                            disabled
                              ? 'cursor-not-allowed opacity-40'
                              : 'hover:bg-accent',
                            selected && 'bg-primary/10',
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {m.metricName}
                            <Badge
                              variant={
                                m.sourceType === 'ALIMI' ? 'alimi' : 'internal'
                              }
                            >
                              {m.sourceType === 'ALIMI' ? '공시' : '자체'}
                            </Badge>
                          </span>
                          {selected && (
                            <span className="text-xs text-primary">선택됨</span>
                          )}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 우: 선택된 지표 */}
          <div className="max-h-[50vh] overflow-y-auto rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">
                선택된 지표 ({selectedMetrics.length})
              </span>
              <Button variant="ghost" size="sm" onClick={clearMetrics}>
                전체 해제
              </Button>
            </div>
            {selectedMetrics.length === 0 && (
              <p className="text-sm text-muted-foreground">
                선택된 지표가 없습니다.
              </p>
            )}
            <div className="space-y-1">
              {selectedMetrics.map((m) => (
                <div
                  key={m.metricId}
                  className="flex items-center justify-between rounded-md bg-secondary px-2 py-1.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    {m.metricName}
                    <Badge
                      variant={m.sourceType === 'ALIMI' ? 'alimi' : 'internal'}
                    >
                      {m.sourceType === 'ALIMI' ? '공시' : '자체'}
                    </Badge>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      toggleMetric({
                        metricId: m.metricId,
                        metricName: m.metricName,
                        sourceType: m.sourceType,
                        unit: m.unit,
                      })
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setOpen(false)}>확인</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
