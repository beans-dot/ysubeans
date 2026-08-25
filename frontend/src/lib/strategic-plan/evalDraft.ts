import type {
  SpBudgetDraft,
  SpEvalActivity,
  SpEvaluationDraft,
  SpFundSource,
  SpIrEvalOverlay,
  SpSurveyItem,
  SpSurveyPlan,
  SpTask,
  SpWriteStatus,
} from './types';
import { parseAmount } from './format';

export const SP_SURVEY_PLAN_GRADES = [
  '신속반영',
  '점진반영',
  '반영불가',
] as const;

export function newEvalRowId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyActivity(): SpEvalActivity {
  return {
    id: newEvalRowId('a'),
    activityName: '',
    performance: '',
    fundSourceId: null,
    executionAmount: '',
    selfCheck: '',
    nextYearFeedback: '',
  };
}

export function emptySurveyItem(): SpSurveyItem {
  return {
    id: newEvalRowId('s'),
    name: '',
    prevValue: '',
    thisValue: '',
    selfEval: '',
  };
}

export function emptySurveyPlan(): SpSurveyPlan {
  return {
    id: newEvalRowId('p'),
    category: '',
    request: '',
    planGrade: '',
    planText: '',
  };
}

export function taskBudgetUnits(task: SpTask) {
  if (task.subtasks.length > 0) {
    return task.subtasks.map((s) => ({
      code: s.subtaskCode,
      name: s.subtaskName,
      displayCode: s.displayCode ?? s.subtaskCode,
    }));
  }
  return [
    {
      code: task.taskCode,
      name: task.taskName,
      displayCode: task.displayCode ?? task.taskCode,
    },
  ];
}

export function activitiesForUnit(
  draft: SpEvaluationDraft | undefined,
  unitCode: string,
): SpEvalActivity[] {
  const rows = draft?.taskActivities?.[unitCode];
  return rows && rows.length > 0 ? rows : [emptyActivity()];
}

export function activityExecTotal(rows: SpEvalActivity[]): number | null {
  const nums = rows
    .map((r) => parseAmount(r.executionAmount))
    .filter((v): v is number => v !== null);
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
}

export function unitSettlementTotal(
  budgets: SpBudgetDraft,
  taskCode: string,
  unitCode: string,
  fundSources: SpFundSource[],
): number | null {
  const nums: number[] = [];
  for (const fund of fundSources) {
    const key = `${taskCode}::${unitCode}::${fund.fundSourceId}`;
    const parsed = parseAmount(budgets[key]?.settlement ?? '');
    if (parsed !== null) nums.push(parsed);
  }
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
}

/** 전년 대비 향상률(%). 전년값이 0이거나 없으면 null */
export function yoyImprovementRate(
  prev: string,
  current: string,
): number | null {
  const p = Number(String(prev).replace(/[,\s]/g, ''));
  const c = Number(String(current).replace(/[,\s]/g, ''));
  if (!Number.isFinite(p) || !Number.isFinite(c) || p === 0) return null;
  return ((c - p) / p) * 100;
}

function filledText(value: string | undefined) {
  return (value ?? '').trim() !== '';
}

function activityFilled(row: SpEvalActivity) {
  return (
    row.activityName.trim() !== '' ||
    row.performance.trim() !== '' ||
    row.executionAmount.trim() !== '' ||
    row.selfCheck.trim() !== '' ||
    row.nextYearFeedback.trim() !== '' ||
    row.fundSourceId !== null
  );
}

function surveyItemFilled(row: SpSurveyItem) {
  return (
    row.name.trim() !== '' ||
    row.prevValue.trim() !== '' ||
    row.thisValue.trim() !== '' ||
    row.selfEval.trim() !== ''
  );
}

function surveyPlanFilled(row: SpSurveyPlan) {
  return (
    row.category.trim() !== '' ||
    row.request.trim() !== '' ||
    row.planGrade.trim() !== '' ||
    row.planText.trim() !== ''
  );
}

const DEPT_TEXT_FIELDS: Array<keyof SpEvaluationDraft> = [
  'deptSummary',
  'deptAnalysis',
  'budgetAdequacy',
  'processAdequacy',
  'kpiAdequacy',
  'surveyAnalysis',
  'surveyFeedback',
];

export function evaluationFilledCount(draft: SpEvaluationDraft | undefined) {
  if (!draft) return 0;
  let n = 0;
  for (const key of DEPT_TEXT_FIELDS) {
    if (filledText(draft[key] as string | undefined)) n += 1;
  }
  for (const key of [
    'budgetAdequacyGrade',
    'processAdequacyGrade',
    'kpiAdequacyGrade',
  ] as const) {
    if (filledText(draft[key])) n += 1;
  }
  if (Object.values(draft.kpiPoEvals ?? {}).some((v) => filledText(v))) n += 1;
  if (Object.values(draft.taskActivities ?? {}).some((rows) => rows.some(activityFilled))) {
    n += 1;
  }
  if ((draft.surveyItems ?? []).some(surveyItemFilled)) n += 1;
  if ((draft.surveyPlans ?? []).some(surveyPlanFilled)) n += 1;
  return n;
}

/**
 * 완료 = 주요 성과·자체분석과 ④ 자체점검 3항목 등급이 모두 있는 상태.
 * IR 평가는 완료 조건에 넣지 않는다.
 */
export function evaluationStatus(
  draft: SpEvaluationDraft | undefined,
): SpWriteStatus {
  const count = evaluationFilledCount(draft);
  if (count === 0) return 'none';
  const complete =
    filledText(draft?.deptSummary) &&
    filledText(draft?.deptAnalysis) &&
    filledText(draft?.budgetAdequacyGrade) &&
    filledText(draft?.processAdequacyGrade) &&
    filledText(draft?.kpiAdequacyGrade);
  return complete ? 'done' : 'part';
}

export function irEvalHasContent(ir: SpIrEvalOverlay | undefined) {
  if (!ir) return false;
  if (Object.values(ir.taskComments ?? {}).some((v) => filledText(v))) return true;
  return [
    ir.kpiComment,
    ir.achievements,
    ir.analysis,
    ir.budgetAdequacy,
    ir.budgetAdequacyGrade,
    ir.processAdequacy,
    ir.processAdequacyGrade,
    ir.kpiAdequacy,
    ir.kpiAdequacyGrade,
    ir.surveyText1,
    ir.surveyText2,
    ir.surveyItemsComment,
    ir.surveyPlansComment,
  ].some((v) => filledText(v));
}

/**
 * 예산·결산 완료 = 금액이 들어간 재원 행마다 예산·결산이 모두 있는 상태.
 * 미입력 = 어떤 재원에도 금액이 없는 상태.
 */
export function budgetStatus(
  rows: Array<{ budget: string; settlement: string }>,
): SpWriteStatus {
  const touched = rows.filter(
    (r) => r.budget.trim() !== '' || r.settlement.trim() !== '',
  );
  if (touched.length === 0) return 'none';
  const allPaired = touched.every(
    (r) => r.budget.trim() !== '' && r.settlement.trim() !== '',
  );
  return allPaired ? 'done' : 'part';
}

export const SP_STATUS_LABEL: Record<SpWriteStatus, string> = {
  done: '작성 완료',
  part: '부분작성',
  none: '미작성',
};

export const SP_STATUS_CLASS: Record<SpWriteStatus, string> = {
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  part: 'bg-amber-50 text-amber-900 border-amber-200',
  none: 'bg-muted text-muted-foreground',
};
