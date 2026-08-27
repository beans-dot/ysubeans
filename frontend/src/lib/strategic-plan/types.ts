export interface SpSubtask {
  subtaskId: number;
  subtaskCode: string;
  hangulCode?: string;
  seqNo?: number;
  displayCode?: string;
  subtaskName: string;
  purpose?: string | null;
  method?: string | null;
}

export interface SpTask {
  taskCode: string;
  hangulCode?: string;
  displayCode?: string;
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
  displayCode?: string;
  strategyName: string;
  goalId: string;
  tasks: SpTask[];
}

export interface SpGoal {
  goalId: string;
  displayCode?: string;
  goalNo: number;
  goalName: string;
  strategies: SpStrategy[];
}

export type SpYearValues = Record<number, number | null>;

export interface SpKpi {
  kpiCode: string;
  displayCode?: string;
  suffix?: string;
  kpiName: string;
  unit: string | null;
  taskCode: string | null;
  strategyId: string | null;
  goalId: string | null;
  primaryDept?: string | null;
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
  /** 비전 체계 화면 본문(게시글형 HTML) */
  contentHtml: string | null;
}

export interface SpTree {
  years: number[];
  asOfYear?: number | null;
  scales: {
    deptGrades: string[];
    irGrades: string[];
    surveyPlanGrades?: string[];
  };
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
  effectiveFrom?: number;
  abolishedFrom?: number | null;
}

export interface SpChangeLog {
  logId: number;
  year: number;
  kind: string;
  kindLabel: string;
  lineageId: string;
  displayCode: string;
  changeType: string;
  changeTypeLabel: string;
  summary: string;
  beforePayload: Record<string, unknown> | null;
  afterPayload: Record<string, unknown> | null;
  changedBy: string | null;
  createdAt: string;
}

export interface SpDepartment {
  deptId: number;
  deptName: string;
  officeCode?: string;
  categoryName?: string | null;
  displayOrder?: number;
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
  taskActivities: Record<string, SpEvalActivity[]> | null;
  kpiPoEvals: Record<string, string> | null;
  kpiPoComments: Record<string, string> | null;
  budgetAdequacy: string | null;
  budgetAdequacyGrade: string | null;
  processAdequacy: string | null;
  processAdequacyGrade: string | null;
  kpiAdequacy: string | null;
  kpiAdequacyGrade: string | null;
  surveyItems: SpSurveyItem[] | null;
  surveyPlans: SpSurveyPlan[] | null;
  surveyItemsNa?: boolean;
  surveyPlansNa?: boolean;
  irEval: SpIrEvalOverlay | null;
  updatedBy: string | null;
}

export interface SpBudget {
  taskCode: string;
  subtaskCode: string;
  year: number;
  fundSourceId: number;
  budgetAmount: number | null;
  settlementAmount: number | null;
}

export interface SpEvalActivity {
  id: string;
  activityName: string;
  performance: string;
  fundSourceId: number | null;
  executionAmount: string;
  selfCheck: string;
  nextYearFeedback: string;
}

export interface SpSurveyItem {
  id: string;
  name: string;
  prevValue: string;
  thisValue: string;
  selfEval: string;
}

export interface SpSurveyPlan {
  id: string;
  category: string;
  area?: string;
  request: string;
  planGrade: string;
  planText: string;
}

export interface SpIrEvalOverlay {
  taskComments?: Record<string, string>;
  kpiComment?: string;
  achievements?: string;
  analysis?: string;
  budgetAdequacy?: string;
  budgetAdequacyGrade?: string;
  processAdequacy?: string;
  processAdequacyGrade?: string;
  kpiAdequacy?: string;
  kpiAdequacyGrade?: string;
  surveyText1?: string;
  surveyText2?: string;
  surveyItemsComment?: string;
  surveyPlansComment?: string;
}

/** 대시보드에서 쓰는 자체평가 문자열 필드 */
export type SpEvaluationTextField =
  | 'deptSummary'
  | 'deptAnalysis'
  | 'budgetAdequacy'
  | 'budgetAdequacyGrade'
  | 'processAdequacy'
  | 'processAdequacyGrade'
  | 'kpiAdequacy'
  | 'kpiAdequacyGrade'
  | 'surveyAnalysis'
  | 'surveyFeedback';

export interface SpEvaluationDraft {
  deptSummary?: string;
  deptAnalysis?: string;
  budgetAdequacy?: string;
  budgetAdequacyGrade?: string;
  processAdequacy?: string;
  processAdequacyGrade?: string;
  kpiAdequacy?: string;
  kpiAdequacyGrade?: string;
  surveyAnalysis?: string;
  surveyFeedback?: string;
  taskActivities?: Record<string, SpEvalActivity[]>;
  kpiPoEvals?: Record<string, string>;
  kpiPoComments?: Record<string, string>;
  surveyItems?: SpSurveyItem[];
  surveyPlans?: SpSurveyPlan[];
  surveyItemsNa?: boolean;
  surveyPlansNa?: boolean;
  irEval?: SpIrEvalOverlay;
}

/** 예산·결산 입력 상태: `${taskCode}::${subtaskCode}::${fundSourceId}` → 문자열 입력값 */
export type SpBudgetDraft = Record<string, { budget: string; settlement: string }>;

export type SpWriteStatus = 'done' | 'part' | 'none';
