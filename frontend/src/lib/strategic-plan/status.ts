import type {
  SpEvaluationDraft,
  SpEvaluationField,
  SpWriteStatus,
} from './types';

export const SP_EVAL_FIELDS: SpEvaluationField[] = [
  'deptSummary',
  'deptAnalysis',
  'deptGrade',
  'deptImprovement',
  'irGrade',
  'irFeedback',
  'surveyGrade',
  'surveyAnalysis',
  'surveyFeedback',
];

const DEPT_TEXT_FIELDS: SpEvaluationField[] = [
  'deptSummary',
  'deptAnalysis',
  'deptImprovement',
];

function filled(draft: SpEvaluationDraft | undefined, field: SpEvaluationField) {
  return (draft?.[field] ?? '').trim() !== '';
}

export function evaluationFilledCount(draft: SpEvaluationDraft | undefined) {
  return SP_EVAL_FIELDS.filter((f) => filled(draft, f)).length;
}

/**
 * 완료 = 부서·IR 등급이 모두 선택되고 각 영역에 서술이 1개 이상 있는 상태.
 * 미작성 = 어떤 칸도 채우지 않은 상태.
 */
export function evaluationStatus(
  draft: SpEvaluationDraft | undefined,
): SpWriteStatus {
  const count = evaluationFilledCount(draft);
  if (count === 0) return 'none';
  const hasDeptText = DEPT_TEXT_FIELDS.some((f) => filled(draft, f));
  const complete =
    filled(draft, 'deptGrade') &&
    filled(draft, 'irGrade') &&
    hasDeptText &&
    filled(draft, 'irFeedback');
  return complete ? 'done' : 'part';
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
