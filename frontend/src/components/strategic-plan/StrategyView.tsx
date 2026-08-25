'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fmt } from '@/lib/strategic-plan/format';
import { goalAccent } from '@/lib/strategic-plan/goalAccent';
import type { SpGoal, SpKpi, SpTask } from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import { TaskHeading } from './TaskHeading';
import { EmptyState, SectionLabel } from './ui';

function TaskRow({
  task,
  kpiByCode,
  lastYear,
}: {
  task: SpTask;
  kpiByCode: Map<string, SpKpi>;
  lastYear: number;
}) {
  const [open, setOpen] = useState(false);
  const accent = goalAccent(task.goalId);

  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 py-2.5 text-left hover:bg-accent/40"
      >
        <ChevronRight
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90',
          )}
        />
        <TaskHeading task={task} showKpiTaskCounts />
      </button>

      {open && (
        <div className="space-y-3 pb-3 pl-6">
          {task.relatedDepts.length > 0 && (
            <p className="text-muted-foreground">
              연관부서: {task.relatedDepts.join(', ')}
            </p>
          )}
          {task.subtasks.length > 0 && (
            <div>
              <SectionLabel>세부 TASK</SectionLabel>
              <ul className={cn('space-y-1 border-l-2 pl-3', accent.border)}>
                {task.subtasks.map((sub) => (
                  <li
                    key={sub.subtaskId}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span>{sub.subtaskName}</span>
                    <Badge variant="code">
                      {sub.displayCode ?? sub.subtaskCode}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {task.kpiCodes.length > 0 && (
            <div>
              <SectionLabel>
                연계 KPI (기준값 → {lastYear} 목표)
              </SectionLabel>
              <ul className={cn('space-y-1 border-l-2 pl-3', accent.border)}>
                {task.kpiCodes.map((code) => {
                  const kpi = kpiByCode.get(code);
                  if (!kpi) return null;
                  return (
                    <li
                      key={code}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <Badge variant="code">
                        {kpi.displayCode ?? kpi.kpiCode}
                      </Badge>
                      <span className="min-w-0 flex-1">{kpi.kpiName}</span>
                      <span className="text-muted-foreground">
                        {fmt(kpi.baseline)} → {fmt(kpi.targets[lastYear])}
                        {kpi.unit ?? ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function StrategyView({
  goals,
  visibleTasks,
  kpiByCode,
  kpiCountByGoal,
  lastYear,
}: {
  goals: SpGoal[];
  visibleTasks: Set<string>;
  kpiByCode: Map<string, SpKpi>;
  kpiCountByGoal: Map<string, number>;
  lastYear: number;
}) {
  const blocks = goals
    .map((goal) => {
      const strategies = goal.strategies
        .map((strategy) => ({
          strategy,
          tasks: strategy.tasks.filter((t) => visibleTasks.has(t.taskCode)),
        }))
        .filter((s) => s.tasks.length > 0);
      return { goal, strategies };
    })
    .filter((block) => block.strategies.length > 0);

  if (blocks.length === 0) {
    return <EmptyState>조건에 맞는 실행과제가 없습니다.</EmptyState>;
  }

  return (
    <div className="space-y-6">
      {blocks.map(({ goal, strategies }) => {
        const accent = goalAccent(goal.goalId);
        const taskCount = strategies.reduce((a, s) => a + s.tasks.length, 0);
        return (
          <section key={goal.goalId}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="code">{goal.displayCode ?? goal.goalId}</Badge>
              <h2>
                {goal.goalNo}. {goal.goalName}
              </h2>
              <span className="text-muted-foreground">
                전략과제 {goal.strategies.length} · 실행과제 {taskCount} · KPI{' '}
                {kpiCountByGoal.get(goal.goalId) ?? 0}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {strategies.map(({ strategy, tasks }) => (
                <Card
                  key={strategy.strategyId}
                  className={cn('border-l-4', accent.border)}
                >
                  <CardContent className="p-4">
                    <h3 className="mb-1 flex flex-wrap items-center gap-2 text-sm font-bold">
                      <Badge variant="code">
                        {strategy.displayCode ?? strategy.strategyId}
                      </Badge>
                      {strategy.strategyName}
                    </h3>
                    <ul>
                      {tasks.map((task) => (
                        <TaskRow
                          key={task.taskCode}
                          task={task}
                          kpiByCode={kpiByCode}
                          lastYear={lastYear}
                        />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
