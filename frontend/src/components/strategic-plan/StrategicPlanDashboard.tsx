'use client';

import { useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  kpiMatches,
  taskMatches,
  type SpFilterState,
} from '@/lib/strategic-plan/filters';
import { SP_SURVEY_PLAN_GRADES } from '@/lib/strategic-plan/evalDraft';
import { useAuthStore } from '@/store/useAuthStore';
import {
  SP_YEAR_VIEWS,
  useStrategicPlanStore,
} from '@/store/useStrategicPlanStore';
import { BudgetView } from './BudgetView';
import { EvaluationReportView } from './EvaluationReportView';
import { EvaluationView } from './EvaluationView';
import { KpiView } from './KpiView';
import { PlanFilters } from './PlanFilters';
import { PlanNav, VIEW_TITLES } from './PlanNav';
import { StrategyView } from './StrategyView';
import { VisionPanel } from './VisionPanel';
import { YearSelect } from './ui';

export function StrategicPlanDashboard() {
  const load = useStrategicPlanStore((s) => s.load);
  const tree = useStrategicPlanStore((s) => s.tree);
  const fundSources = useStrategicPlanStore((s) => s.fundSources);
  const loading = useStrategicPlanStore((s) => s.loading);
  const entryLoading = useStrategicPlanStore((s) => s.entryLoading);
  const error = useStrategicPlanStore((s) => s.error);
  const saveError = useStrategicPlanStore((s) => s.saveError);
  const view = useStrategicPlanStore((s) => s.view);
  const goalId = useStrategicPlanStore((s) => s.goalId);
  const dept = useStrategicPlanStore((s) => s.dept);
  const query = useStrategicPlanStore((s) => s.query);
  const specializedOnly = useStrategicPlanStore((s) => s.specializedOnly);
  const year = useStrategicPlanStore((s) => s.year);
  const setYear = useStrategicPlanStore((s) => s.setYear);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  useEffect(() => {
    void load();
  }, [load]);

  const filters: SpFilterState = useMemo(
    () => ({ goalId, dept, query, specializedOnly }),
    [goalId, dept, query, specializedOnly],
  );

  const derived = useMemo(() => {
    if (!tree) return null;
    const kpiByCode = new Map(tree.kpis.map((k) => [k.kpiCode, k]));
    const taskByCode = new Map(tree.tasks.map((t) => [t.taskCode, t]));
    const depts = [
      ...new Set(
        tree.tasks
          .map((t) => t.primaryDept)
          .filter((d): d is string => Boolean(d)),
      ),
    ].sort((a, b) => a.localeCompare(b, 'ko'));
    const kpiCountByGoal = new Map<string, number>();
    for (const kpi of tree.kpis) {
      if (!kpi.goalId) continue;
      kpiCountByGoal.set(kpi.goalId, (kpiCountByGoal.get(kpi.goalId) ?? 0) + 1);
    }
    return { kpiByCode, taskByCode, depts, kpiCountByGoal };
  }, [tree]);

  const filtered = useMemo(() => {
    if (!tree || !derived) return null;
    const tasks = tree.tasks.filter((t) =>
      taskMatches(t, filters, derived.kpiByCode),
    );
    const kpis = tree.kpis.filter((k) =>
      kpiMatches(k, filters, derived.taskByCode),
    );
    return {
      tasks,
      kpis,
      taskCodes: new Set(tasks.map((t) => t.taskCode)),
    };
  }, [tree, derived, filters]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        불러오는 중입니다…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!tree || !derived || !filtered) return null;

  const showYear = SP_YEAR_VIEWS.includes(view);
  const lastYear = year;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <PlanNav />

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">{VIEW_TITLES[view]}</h2>
          {showYear && (
            <YearSelect years={tree.years} year={year} onChange={setYear} />
          )}
        </div>

        {(saveError || entryLoading) && (
          <div
            className={
              saveError
                ? 'mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'
                : 'mb-3 flex items-center gap-2 text-muted-foreground'
            }
          >
            {saveError ?? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                입력값 불러오는 중…
              </>
            )}
          </div>
        )}

        {view === 'vision' && (
          <VisionPanel vision={tree.vision} canEdit={isAdmin()} />
        )}

        {view === 'strategy' && (
          <>
            <PlanFilters goals={tree.goals} depts={derived.depts} />
            <StrategyView
              goals={tree.goals}
              visibleTasks={filtered.taskCodes}
              kpiByCode={derived.kpiByCode}
              kpiCountByGoal={derived.kpiCountByGoal}
              lastYear={lastYear}
            />
          </>
        )}

        {view === 'budget' && (
          <BudgetView tasks={tree.tasks} fundSources={fundSources} />
        )}

        {view === 'eval' && (
          <EvaluationView
            tasks={tree.tasks}
            fundSources={fundSources}
            deptGrades={tree.scales.deptGrades}
            surveyPlanGrades={
              tree.scales.surveyPlanGrades ?? [...SP_SURVEY_PLAN_GRADES]
            }
            canEditResults={isAdmin()}
          />
        )}

        {view === 'kpi' && (
          <KpiView
            kpis={tree.kpis}
            taskByCode={derived.taskByCode}
            years={tree.years}
            year={year}
          />
        )}

        {view === 'settlement' && (
          <BudgetView
            tasks={tree.tasks}
            fundSources={fundSources}
            readOnly
            exportable
          />
        )}

        {view === 'eval-report' && (
          <EvaluationReportView
            tasks={tree.tasks}
            fundSources={fundSources}
          />
        )}
      </div>
    </div>
  );
}
