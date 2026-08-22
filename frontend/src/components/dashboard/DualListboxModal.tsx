'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { api, type CategoryTreeNode } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAnalysisStore } from '@/store/AnalysisStoreProvider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function DualListboxModal() {
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  const selectedMetrics = useAnalysisStore((s) => s.selectedMetrics);
  const toggleMetric = useAnalysisStore((s) => s.toggleMetric);
  const clearMetrics = useAnalysisStore((s) => s.clearMetrics);
  const analysisScope = useAnalysisStore((s) => s.analysisScope);
  const sourceType = analysisScope === 'internal' ? 'INTERNAL' : 'ALIMI';

  useEffect(() => {
    if (open && !loaded) {
      api
        .get<CategoryTreeNode[]>('/metrics/tree', { params: { sourceType } })
        .then(({ data }) => setTree(data))
        .catch(() => setTree([]))
        .finally(() => setLoaded(true));
    }
  }, [open, loaded, sourceType]);

  useEffect(() => {
    if (!open) setSearchQuery('');
  }, [open]);

  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tree
      .map((cat) => ({
        ...cat,
        metrics: q
          ? cat.metrics.filter((m) => m.metricName.toLowerCase().includes(q))
          : cat.metrics,
      }))
      .filter((cat) => cat.metrics.length > 0);
  }, [tree, searchQuery]);

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

        <div className="grid grid-cols-2 gap-4">
          {/* 좌: 사용 가능 지표 (카테고리별) */}
          <div className="flex max-h-[50vh] flex-col rounded-md border p-3">
            <div className="mb-2 text-xs font-bold text-muted-foreground">
              사용 가능 지표
            </div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="지표명 검색"
                className="h-9 pl-8 pr-8"
                aria-label="지표명 검색"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="검색어 지우기"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tree.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  등록된 지표가 없습니다.
                </p>
              )}
              {tree.length > 0 && filteredTree.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  검색 결과가 없습니다.
                </p>
              )}
              {filteredTree.map((cat) => (
                <div key={cat.categoryId} className="mb-3">
                  <div className="mb-1 text-sm font-bold text-foreground">
                    {cat.categoryName}
                  </div>
                  <div className="space-y-1">
                    {cat.metrics.map((m) => {
                      const selected = isSelected(m.metricId);
                      return (
                        <button
                          key={m.metricId}
                          type="button"
                          onClick={() =>
                            toggleMetric({
                              metricId: m.metricId,
                              metricName: m.metricName,
                              sourceType: m.sourceType,
                              unit: m.metricUnit,
                            })
                          }
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                            selected && 'bg-primary/10',
                          )}
                        >
                          <span>{m.metricName}</span>
                          {selected && (
                            <span className="text-xs text-primary">선택됨</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
                  <span>{m.metricName}</span>
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
