'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { api, type UpdateLog, type UpdateLogMetricDetail } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function formatDeptSummary(metric: UpdateLogMetricDetail): string {
  if (metric.deptCount <= 0 || !metric.sampleDept) return '대학 전체';
  if (metric.deptCount === 1) return metric.sampleDept;
  return `${metric.sampleDept} 등 ${metric.deptCount}개과`;
}

export default function UpdateHistoryPage() {
  const [logs, setLogs] = useState<UpdateLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<UpdateLog[]>('/update-log')
      .then(({ data }) => setLogs(data))
      .catch(() => setLogs([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <AuthGuard>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl">업데이트 이력</h1>

        {!loaded && <p className="text-muted-foreground">불러오는 중...</p>}
        {loaded && logs.length === 0 && (
          <p className="text-muted-foreground">업데이트 내역이 없습니다.</p>
        )}

        <div className="space-y-3">
          {logs.map((log) => {
            const open = openId === log.logId;
            const metrics = log.detail?.metrics ?? [];
            return (
              <Card key={log.logId} className="overflow-hidden">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : log.logId)}
                  className="w-full text-left transition-colors hover:bg-muted/40"
                >
                  <CardContent className="flex items-start gap-4 px-6 py-4">
                    <Badge variant="secondary" className="mt-0.5 shrink-0">
                      {log.updateType}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-foreground">{log.logText}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(log.updateDate).toLocaleString('ko-KR')}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                        open && 'rotate-180',
                      )}
                    />
                  </CardContent>
                </button>

                {open && (
                  <div className="border-t bg-muted/20 px-6 py-4">
                    {metrics.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        이 이력에는 지표·학과 요약이 없습니다.
                      </p>
                    ) : (
                      <>
                        <p className="mb-3 text-xs text-muted-foreground">
                          업로드 지표 {metrics.length}개
                          {metrics.some((m) => m.isNew)
                            ? ` · 신규 ${metrics.filter((m) => m.isNew).length}개`
                            : ''}
                        </p>
                        <ul className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
                          {metrics.map((m, i) => (
                            <li key={`${m.metricName}-${i}`} className="min-w-0">
                              <div className="flex items-start gap-2">
                                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                                  {m.metricName}
                                </span>
                                {m.isNew && (
                                  <Badge variant="default" className="shrink-0">
                                    신규
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {formatDeptSummary(m)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AuthGuard>
  );
}
