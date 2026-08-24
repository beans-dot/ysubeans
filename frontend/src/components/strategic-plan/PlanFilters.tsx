'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { goalAccent } from '@/lib/strategic-plan/goalAccent';
import type { SpGoal } from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import { useStrategicPlanStore } from '@/store/useStrategicPlanStore';
import { NativeSelect } from './ui';

export function PlanFilters({
  goals,
  depts,
}: {
  goals: SpGoal[];
  depts: string[];
}) {
  const goalId = useStrategicPlanStore((s) => s.goalId);
  const dept = useStrategicPlanStore((s) => s.dept);
  const query = useStrategicPlanStore((s) => s.query);
  const specializedOnly = useStrategicPlanStore((s) => s.specializedOnly);
  const setGoalId = useStrategicPlanStore((s) => s.setGoalId);
  const setDept = useStrategicPlanStore((s) => s.setDept);
  const setQuery = useStrategicPlanStore((s) => s.setQuery);
  const setSpecializedOnly = useStrategicPlanStore((s) => s.setSpecializedOnly);
  const resetFilters = useStrategicPlanStore((s) => s.resetFilters);

  const [draft, setDraft] = useState(query);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(draft.trim()), 200);
    return () => clearTimeout(timer);
  }, [draft, setQuery]);

  const hasFilter = Boolean(goalId || dept || query || specializedOnly);

  return (
    <div className="mb-4 rounded-md border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setGoalId('')}
          aria-pressed={goalId === ''}
          className={cn(
            'rounded-full border px-3 py-1 font-bold transition-colors',
            goalId === ''
              ? 'border-primary bg-primary text-primary-foreground'
              : 'hover:bg-accent',
          )}
        >
          전체
        </button>
        {goals.map((goal) => {
          const accent = goalAccent(goal.goalId);
          const active = goalId === goal.goalId;
          return (
            <button
              key={goal.goalId}
              type="button"
              onClick={() => setGoalId(active ? '' : goal.goalId)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 font-bold transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', accent.dot)}
              />
              {goal.goalId}. {goal.goalName}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={specializedOnly}
            onCheckedChange={setSpecializedOnly}
            aria-label="특성화 연계 과제만 보기"
          />
          특성화 연계만
        </label>

        <NativeSelect
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          aria-label="책임부서"
        >
          <option value="">모든 책임부서</option>
          {depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </NativeSelect>

        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="과제·지표·부서 검색"
            className="h-9 pl-8"
          />
        </div>

        {hasFilter && (
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            <X className="mr-1 h-4 w-4" />
            필터 해제
          </Button>
        )}
      </div>
    </div>
  );
}
