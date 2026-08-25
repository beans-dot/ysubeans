import {
  type SpEvalActivityJson,
  type SpIrEvalJson,
  type SpSurveyItemJson,
  type SpSurveyPlanJson,
} from '../../entities/ir-sp-evaluation.entity';
import {
  SP_DEPT_GRADES,
  SP_SURVEY_PLAN_GRADES,
} from './strategic-plan.constants';

const MAX_ROWS = 50;
const MAX_TEXT = 8000;
const MAX_NAME = 400;
const MAX_ID = 80;
const MAX_TASKS = 80;

function asTrimmed(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function asGrade(
  value: unknown,
  allowed: readonly string[],
): string | null {
  const text = asTrimmed(value, 20);
  if (!text) return null;
  return allowed.includes(text) ? text : null;
}

function asFundSourceId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function asId(value: unknown, fallback: string): string {
  const text = asTrimmed(value, MAX_ID);
  return text || fallback;
}

export function sanitizeTaskActivities(
  raw: unknown,
): Record<string, SpEvalActivityJson[]> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, SpEvalActivityJson[]> = {};
  for (const [code, rows] of Object.entries(raw as Record<string, unknown>)) {
    const key = asTrimmed(code, 80);
    if (!key || !Array.isArray(rows)) continue;
    if (Object.keys(out).length >= MAX_TASKS) break;
    out[key] = rows.slice(0, MAX_ROWS).map((row, index) => {
      const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      return {
        id: asId(r.id, `a-${index + 1}`),
        activityName: asTrimmed(r.activityName, MAX_NAME),
        performance: asTrimmed(r.performance, MAX_TEXT),
        fundSourceId: asFundSourceId(r.fundSourceId),
        executionAmount: asTrimmed(r.executionAmount, 40),
        selfCheck: asGrade(r.selfCheck, SP_DEPT_GRADES) ?? '',
        nextYearFeedback: asTrimmed(r.nextYearFeedback, MAX_TEXT),
      };
    });
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function sanitizeKpiPoEvals(
  raw: unknown,
): Record<string, string> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [code, grade] of Object.entries(raw as Record<string, unknown>)) {
    const key = asTrimmed(code, 30);
    const value = asGrade(grade, SP_DEPT_GRADES);
    if (!key || !value) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function sanitizeSurveyItems(raw: unknown): SpSurveyItemJson[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const rows = raw.slice(0, MAX_ROWS).map((row, index) => {
    const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    return {
      id: asId(r.id, `s-${index + 1}`),
      name: asTrimmed(r.name, MAX_NAME),
      prevValue: asTrimmed(r.prevValue, 40),
      thisValue: asTrimmed(r.thisValue, 40),
      selfEval: asGrade(r.selfEval, SP_DEPT_GRADES) ?? '',
    };
  });
  return rows.length > 0 ? rows : null;
}

export function sanitizeSurveyPlans(raw: unknown): SpSurveyPlanJson[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const rows = raw.slice(0, MAX_ROWS).map((row, index) => {
    const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    return {
      id: asId(r.id, `p-${index + 1}`),
      category: asTrimmed(r.category, MAX_NAME),
      request: asTrimmed(r.request, MAX_TEXT),
      planGrade: asGrade(r.planGrade, SP_SURVEY_PLAN_GRADES) ?? '',
      planText: asTrimmed(r.planText, MAX_TEXT),
    };
  });
  return rows.length > 0 ? rows : null;
}

export function sanitizeIrEval(raw: unknown): SpIrEvalJson | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const taskComments: Record<string, string> = {};
  if (r.taskComments && typeof r.taskComments === 'object' && !Array.isArray(r.taskComments)) {
    for (const [code, text] of Object.entries(
      r.taskComments as Record<string, unknown>,
    )) {
      const key = asTrimmed(code, 80);
      const value = asTrimmed(text, MAX_TEXT);
      if (key && value) taskComments[key] = value;
    }
  }
  const out: SpIrEvalJson = {
    taskComments,
    kpiComment: asTrimmed(r.kpiComment, MAX_TEXT),
    achievements: asTrimmed(r.achievements, MAX_TEXT),
    analysis: asTrimmed(r.analysis, MAX_TEXT),
    budgetAdequacy: asTrimmed(r.budgetAdequacy, MAX_TEXT),
    budgetAdequacyGrade: asGrade(r.budgetAdequacyGrade, SP_DEPT_GRADES) ?? '',
    processAdequacy: asTrimmed(r.processAdequacy, MAX_TEXT),
    processAdequacyGrade: asGrade(r.processAdequacyGrade, SP_DEPT_GRADES) ?? '',
    kpiAdequacy: asTrimmed(r.kpiAdequacy, MAX_TEXT),
    kpiAdequacyGrade: asGrade(r.kpiAdequacyGrade, SP_DEPT_GRADES) ?? '',
    surveyText1: asTrimmed(r.surveyText1, MAX_TEXT),
    surveyText2: asTrimmed(r.surveyText2, MAX_TEXT),
    surveyItemsComment: asTrimmed(r.surveyItemsComment, MAX_TEXT),
    surveyPlansComment: asTrimmed(r.surveyPlansComment, MAX_TEXT),
  };
  const hasText = Object.entries(out).some(([key, value]) => {
    if (key === 'taskComments') return Object.keys(taskComments).length > 0;
    return typeof value === 'string' && value.trim() !== '';
  });
  return hasText ? out : null;
}
