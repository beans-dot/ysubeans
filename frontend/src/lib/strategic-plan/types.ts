export interface SpSubtask {
  subtaskId: number;
  subtaskCode: string;
  subtaskName: string;
}

export interface SpTask {
  taskCode: string;
  taskName: string;
  strategyId: string;
  goalId: string;
  isSpecialized: boolean;
  primaryDept: string | null;
  relatedDepts: string[];
  subtasks: SpSubtask[];
  kpiCodes: string[];
}

export interface SpStrategy {
  strategyId: string;
  strategyName: string;
  goalId: string;
  tasks: SpTask[];
}

export interface SpGoal {
  goalId: string;
  goalNo: number;
  goalName: string;
  strategies: SpStrategy[];
}

export type SpYearValues = Record<number, number | null>;

export interface SpKpi {
  kpiCode: string;
  kpiName: string;
  unit: string | null;
  taskCode: string | null;
  strategyId: string | null;
  goalId: string | null;
  baseline: number | null;
  baselineRef: string | null;
  formula: string | null;
  source: string | null;
  targets: SpYearValues;
  results: SpYearValues;
}

export interface SpMottoPair {
  motto: string;
  talent: string;
}

export interface SpVision {
  officialName: string | null;
  planPeriod: string | null;
  structureSummary: string | null;
  visionStatement: string | null;
  visionGoal: string | null;
  mission: string | null;
  keyIndicators: string[];
  foundingPhilosophy: string[];
  mottoPairs: SpMottoPair[];
  talent3c: { name: string; items: string[] } | null;
}

export interface SpTree {
  years: number[];
  scales: { deptGrades: string[]; irGrades: string[] };
  vision: SpVision | null;
  goals: SpGoal[];
  tasks: SpTask[];
  kpis: SpKpi[];
}

export interface SpCompareGroup {
  N?: number;
  mean?: number | null;
  median?: number | null;
  ysu?: number | null;
  rank?: number | null;
  b5?: number | null;
  top5?: boolean;
}

export interface SpComparePayload {
  jc?: SpCompareGroup;
  un?: SpCompareGroup;
  al?: SpCompareGroup;
}

export interface SpCompareIndicator {
  id: string;
  name: string;
  src: string | null;
  srcLabel: string | null;
  priv: boolean;
  years: Record<number, SpComparePayload>;
  alt: { label: string; years: Record<number, SpCompareGroup> } | null;
}

export interface SpCompare {
  years: number[];
  indicators: SpCompareIndicator[];
}

export interface SpFundSource {
  fundSourceId: number;
  fundSourceName: string;
  displayOrder: number;
  isActive: boolean;
}

export interface SpEvaluation {
  evaluationId: number;
  taskCode: string;
  year: number;
  deptSummary: string | null;
  deptAnalysis: string | null;
  deptGrade: string | null;
  deptImprovement: string | null;
  irGrade: string | null;
  irFeedback: string | null;
  surveyGrade: string | null;
  surveyAnalysis: string | null;
  surveyFeedback: string | null;
  updatedBy: string | null;
}

export interface SpBudget {
  taskCode: string;
  year: number;
  fundSourceId: number;
  budgetAmount: number | null;
  settlementAmount: number | null;
}

/** 대시보드에서 쓰는 자체평가 입력 필드 키 */
export type SpEvaluationField =
  | 'deptSummary'
  | 'deptAnalysis'
  | 'deptGrade'
  | 'deptImprovement'
  | 'irGrade'
  | 'irFeedback'
  | 'surveyGrade'
  | 'surveyAnalysis'
  | 'surveyFeedback';

export type SpEvaluationDraft = Partial<Record<SpEvaluationField, string>>;

/** 예산·결산 입력 상태: `${taskCode}::${fundSourceId}` → 문자열 입력값 */
export type SpBudgetDraft = Record<string, { budget: string; settlement: string }>;

export type SpWriteStatus = 'done' | 'part' | 'none';
