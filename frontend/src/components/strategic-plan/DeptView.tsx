'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { goalAccent } from '@/lib/strategic-plan/goalAccent';
import type { SpGoal, SpTask } from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import { useStrategicPlanStore } from '@/store/useStrategicPlanStore';
import { EmptyState } from './ui';

interface DeptSummary {
  dept: string;
  total: number;
  kpiCount: number;
  byGoal: Record<string, number>;
  tasks: SpTask[];
  relatedCount: number;
}

export function DeptView({
  goals,
  tasks,
}: {
  goals: SpGoal[];
  /** 책임부서 필터를 뺀 실행과제 목록 */
  tasks: SpTask[];
}) {
  const setDept = useStrategicPlanStore((s) => s.setDept);
  const setView = useStrategicPlanStore((s) => s.setView);
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());

  const summaries = useMemo<DeptSummary[]>(() => {
    const map = new Map<string, DeptSummary>();
    for (const task of tasks) {
      const dept = task.primaryDept ?? '미지정';
      let entry = map.get(dept);
      if (!entry) {
        entry = {
          dept,
          total: 0,
          kpiCount: 0,
          byGoal: {},
          tasks: [],
          relatedCount: 0,
        };
        map.set(dept, entry);
      }
      entry.total += 1;
      entry.kpiCount += task.kpiCodes.length;
      entry.byGoal[task.goalId] = (entry.byGoal[task.goalId] ?? 0) + 1;
      entry.tasks.push(task);
    }
    for (const entry of map.values()) {
      entry.relatedCount = tasks.filter((t) =>
        t.relatedDepts.includes(entry.dept),
      ).length;
    }
    return [...map.values()].sort(
      (a, b) => b.total - a.total || a.dept.localeCompare(b.dept, 'ko'),
    );
  }, [tasks]);

  if (summaries.length === 0) {
    return <EmptyState>조건에 맞는 부서가 없습니다.</EmptyState>;
  }

  const max = Math.max(...summaries.map((s) => s.total));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        {goals.map((goal) => (
          <span key={goal.goalId} className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                goalAccent(goal.goalId).dot,
              )}
            />
            {goal.goalId}. {goal.goalName}
          </span>
        ))}
      </div>

      <div className="divide-y rounded-md border">
        {summaries.map((entry) => {
          const open = openDepts.has(entry.dept);
          return (
            <div key={entry.dept}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setOpenDepts((prev) => {
                    const next = new Set(prev);
                    if (next.has(entry.dept)) next.delete(entry.dept);
                    else next.add(entry.dept);
                    return next;
                  })
                }
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/40"
              >
                <ChevronRight
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    open && 'rotate-90',
                  )}
                />
                <span className="w-40 shrink-0">
                  <span className="block text-sm font-bold">{entry.dept}</span>
                  <span className="block text-muted-foreground">
                    연계 KPI {entry.kpiCount}개
                  </span>
                </span>
                <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  {goals.map((goal) => {
                    const n = entry.byGoal[goal.goalId] ?? 0;
                    if (!n) return null;
                    return (
                      <span
                        key={goal.goalId}
                        className={cn('h-full', goalAccent(goal.goalId).dot)}
                        style={{ width: `${(n / max) * 100}%` }}
                        title={`${entry.dept} · ${goal.goalId} ${goal.goalName}: ${n}건`}
                      />
                    );
                  })}
                </span>
                <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums">
                  {entry.total}
                </span>
              </button>

              {open && (
                <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
                  <ul className="space-y-1">
                    {entry.tasks.map((task) => (
                      <li
                        key={task.taskCode}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <Badge
                          variant="outline"
                          className={goalAccent(task.goalId).badge}
                        >
                          {task.strategyId}
                        </Badge>
                        <Badge variant="code">{task.taskCode}</Badge>
                        <span>{task.taskName}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-muted-foreground">
                      연관부서로 참여 {entry.relatedCount}건
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDept(entry.dept);
                        setView('strategy');
                      }}
                    >
                      이 부서로 필터해 전략체계 보기
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground">
        막대는 책임부서 기준 실행과제 수이며 발전전략별로 색을 나눴습니다.
        연관부서 참여 건수는 막대 집계에서 빠집니다.
      </p>
    </div>
  );
}
