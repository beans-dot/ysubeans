import { api } from '@/lib/api';
import type {
  SpBudget,
  SpCompare,
  SpEvaluation,
  SpFundSource,
  SpKpi,
  SpTree,
} from './types';

export async function fetchSpTree() {
  const { data } = await api.get<SpTree>('/strategic-plan/tree');
  return data;
}

export async function fetchSpCompare() {
  const { data } = await api.get<SpCompare>('/strategic-plan/compare');
  return data;
}

export async function fetchSpFundSources(includeInactive = false) {
  const { data } = await api.get<SpFundSource[]>(
    '/strategic-plan/fund-sources',
    { params: includeInactive ? { includeInactive: 'true' } : undefined },
  );
  return data;
}

export async function fetchSpEvaluations(year: number) {
  const { data } = await api.get<SpEvaluation[]>(
    '/strategic-plan/evaluations',
    { params: { year } },
  );
  return data;
}

export async function saveSpEvaluation(payload: {
  taskCode: string;
  year: number;
  deptSummary?: string | null;
  deptAnalysis?: string | null;
  deptGrade?: string | null;
  deptImprovement?: string | null;
  irGrade?: string | null;
  irFeedback?: string | null;
  surveyGrade?: string | null;
  surveyAnalysis?: string | null;
  surveyFeedback?: string | null;
}) {
  const { data } = await api.put<SpEvaluation>(
    '/strategic-plan/evaluations',
    payload,
  );
  return data;
}

export async function fetchSpBudgets(year: number) {
  const { data } = await api.get<SpBudget[]>('/strategic-plan/budgets', {
    params: { year },
  });
  return data;
}

export async function saveSpBudget(payload: {
  taskCode: string;
  year: number;
  fundSourceId: number;
  budgetAmount?: number | null;
  settlementAmount?: number | null;
}) {
  const { data } = await api.put<SpBudget>('/strategic-plan/budgets', payload);
  return data;
}

export async function saveSpKpiResult(
  kpiCode: string,
  year: number,
  value: number | null,
) {
  await api.put(`/strategic-plan/kpis/${encodeURIComponent(kpiCode)}/results/${year}`, {
    value,
  });
}

export async function saveSpKpiTarget(
  kpiCode: string,
  year: number,
  value: number | null,
) {
  await api.put(`/strategic-plan/kpis/${encodeURIComponent(kpiCode)}/targets/${year}`, {
    value,
  });
}

/* ── 관리자 ── */

export async function createSpGoal(payload: {
  goalId: string;
  goalNo?: number;
  goalName: string;
}) {
  await api.post('/strategic-plan/goals', payload);
}

export async function updateSpGoal(
  goalId: string,
  payload: { goalNo?: number; goalName?: string },
) {
  await api.put(`/strategic-plan/goals/${encodeURIComponent(goalId)}`, payload);
}

export async function deleteSpGoal(goalId: string) {
  await api.delete(`/strategic-plan/goals/${encodeURIComponent(goalId)}`);
}

export async function createSpStrategy(payload: {
  strategyId: string;
  goalId: string;
  strategyName: string;
  displayOrder?: number;
}) {
  await api.post('/strategic-plan/strategies', payload);
}

export async function updateSpStrategy(
  strategyId: string,
  payload: { goalId?: string; strategyName?: string; displayOrder?: number },
) {
  await api.put(
    `/strategic-plan/strategies/${encodeURIComponent(strategyId)}`,
    payload,
  );
}

export async function deleteSpStrategy(strategyId: string) {
  await api.delete(
    `/strategic-plan/strategies/${encodeURIComponent(strategyId)}`,
  );
}

export async function createSpTask(payload: {
  taskCode: string;
  taskName: string;
  strategyId: string;
  isSpecialized?: boolean;
  primaryDept?: string;
  relatedDepts?: string[];
  displayOrder?: number;
}) {
  await api.post('/strategic-plan/tasks', payload);
}

export async function updateSpTask(
  taskCode: string,
  payload: {
    taskName?: string;
    strategyId?: string;
    isSpecialized?: boolean;
    primaryDept?: string;
    relatedDepts?: string[];
    displayOrder?: number;
  },
) {
  await api.put(`/strategic-plan/tasks/${encodeURIComponent(taskCode)}`, payload);
}

export async function deleteSpTask(taskCode: string) {
  await api.delete(`/strategic-plan/tasks/${encodeURIComponent(taskCode)}`);
}

export async function replaceSpSubtasks(
  taskCode: string,
  subtasks: Array<{ subtaskCode: string; subtaskName: string }>,
) {
  await api.put(
    `/strategic-plan/tasks/${encodeURIComponent(taskCode)}/subtasks`,
    { subtasks },
  );
}

export async function updateSpKpi(
  kpiCode: string,
  payload: Partial<Pick<SpKpi, 'kpiName' | 'unit' | 'baseline' | 'formula'>> & {
    taskCode?: string;
    baselineRef?: string;
    source?: string;
  },
) {
  await api.put(`/strategic-plan/kpis/${encodeURIComponent(kpiCode)}`, payload);
}

export async function createSpFundSource(fundSourceName: string) {
  await api.post('/strategic-plan/fund-sources', { fundSourceName });
}

export async function updateSpFundSource(
  fundSourceId: number,
  payload: {
    fundSourceName?: string;
    displayOrder?: number;
    isActive?: boolean;
  },
) {
  await api.put(`/strategic-plan/fund-sources/${fundSourceId}`, payload);
}

export async function deleteSpFundSource(fundSourceId: number) {
  const { data } = await api.delete<{ deactivated: boolean; used: number }>(
    `/strategic-plan/fund-sources/${fundSourceId}`,
  );
  return data;
}

export async function updateSpVision(payload: {
  officialName?: string | null;
  planPeriod?: string | null;
  visionStatement?: string | null;
  visionGoal?: string | null;
  mission?: string | null;
  keyIndicators?: string[];
  foundingPhilosophy?: string[];
  mottoPairs?: Array<{ motto: string; talent: string }>;
  talent3c?: { name: string; items: string[] } | null;
}) {
  await api.put('/strategic-plan/vision', payload);
}

export async function replaceSpCompare(payload: SpCompare) {
  const { data } = await api.put<SpCompare>('/strategic-plan/compare', payload);
  return data;
}
