import type { SpKpi, SpTask } from './types';

export interface SpFilterState {
  goalId: string;
  dept: string;
  query: string;
  specializedOnly: boolean;
}

/** 책임부서 필터를 뺀 공통 조건. 부서별 뷰는 이 버전을 쓴다. */
export function taskMatchesBase(
  task: SpTask,
  filters: SpFilterState,
  kpiByCode: Map<string, SpKpi>,
): boolean {
  if (filters.goalId && task.goalId !== filters.goalId) return false;
  if (filters.specializedOnly && !task.isSpecialized) return false;
  if (filters.query) {
    const q = filters.query.toLowerCase();
    const haystack = [
      task.taskCode,
      task.taskName,
      task.primaryDept ?? '',
      ...task.relatedDepts,
      ...task.subtasks.map((s) => s.subtaskName),
      ...task.kpiCodes.map((c) => kpiByCode.get(c)?.kpiName ?? ''),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export function taskMatches(
  task: SpTask,
  filters: SpFilterState,
  kpiByCode: Map<string, SpKpi>,
): boolean {
  if (filters.dept && task.primaryDept !== filters.dept) return false;
  return taskMatchesBase(task, filters, kpiByCode);
}

export function kpiMatches(
  kpi: SpKpi,
  filters: SpFilterState,
  taskByCode: Map<string, SpTask>,
): boolean {
  const task = kpi.taskCode ? taskByCode.get(kpi.taskCode) : undefined;
  if (filters.goalId && kpi.goalId !== filters.goalId) return false;
  if (filters.dept && task?.primaryDept !== filters.dept) return false;
  if (filters.specializedOnly && !task?.isSpecialized) return false;
  if (filters.query) {
    const q = filters.query.toLowerCase();
    const haystack = [
      kpi.kpiCode,
      kpi.kpiName,
      kpi.formula ?? '',
      task?.taskName ?? '',
      task?.primaryDept ?? '',
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}
