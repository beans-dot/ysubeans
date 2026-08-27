import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export interface SpEvalActivityJson {
  id: string;
  activityName: string;
  performance: string;
  fundSourceId: number | null;
  executionAmount: string;
  selfCheck: string;
  nextYearFeedback: string;
}

export interface SpSurveyItemJson {
  id: string;
  name: string;
  prevValue: string;
  thisValue: string;
  selfEval: string;
}

export interface SpSurveyPlanJson {
  id: string;
  category: string;
  area: string;
  request: string;
  planGrade: string;
  planText: string;
}

export interface SpIrEvalJson {
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

/** 실행과제별 연도 자체평가 (부서 자체평가 + IR평가) */
@Entity('ir_sp_evaluation')
@Unique('uq_sp_evaluation', ['taskCode', 'year'])
export class IrSpEvaluation {
  @PrimaryGeneratedColumn({ name: 'evaluation_id' })
  evaluationId: number;

  @Index()
  @Column({ name: 'task_code', type: 'varchar', length: 60 })
  taskCode: string;

  @Column({ name: 'year', type: 'int' })
  year: number;

  /** ③ 주요 성과(우수사례) */
  @Column({ name: 'dept_summary', type: 'text', nullable: true })
  deptSummary: string | null;

  /** ③ 부서 자체분석 및 개선방향 */
  @Column({ name: 'dept_analysis', type: 'text', nullable: true })
  deptAnalysis: string | null;

  /** @deprecated 구 부서 자체점검. 신규 입력은 ④ 항목별 등급 사용 */
  @Column({ name: 'dept_grade', type: 'varchar', length: 20, nullable: true })
  deptGrade: string | null;

  /** @deprecated */
  @Column({ name: 'dept_improvement', type: 'text', nullable: true })
  deptImprovement: string | null;

  /** @deprecated 구 IR 등급. 신규 입력은 ir_eval JSON */
  @Column({ name: 'ir_grade', type: 'varchar', length: 20, nullable: true })
  irGrade: string | null;

  /** @deprecated */
  @Column({ name: 'ir_feedback', type: 'text', nullable: true })
  irFeedback: string | null;

  /** @deprecated */
  @Column({ name: 'survey_grade', type: 'varchar', length: 20, nullable: true })
  surveyGrade: string | null;

  /** ⑤ 만족도 자체평가 입력란 1 */
  @Column({ name: 'survey_analysis', type: 'text', nullable: true })
  surveyAnalysis: string | null;

  /** ⑤ 만족도 자체평가 입력란 2 */
  @Column({ name: 'survey_feedback', type: 'text', nullable: true })
  surveyFeedback: string | null;

  /** ① TASK별 사업/프로그램 자체평가 — subtaskCode → 행 목록 */
  @Column({ name: 'task_activities', type: 'jsonb', nullable: true })
  taskActivities: Record<string, SpEvalActivityJson[]> | null;

  /** ② 성과지표 자체평가 — kpiCode → 등급 */
  @Column({ name: 'kpi_po_evals', type: 'jsonb', nullable: true })
  kpiPoEvals: Record<string, string> | null;

  /** ② 성과지표 자체평가 자유서술 — kpiCode → 텍스트 */
  @Column({ name: 'kpi_po_comments', type: 'jsonb', nullable: true })
  kpiPoComments: Record<string, string> | null;

  @Column({ name: 'budget_adequacy', type: 'text', nullable: true })
  budgetAdequacy: string | null;

  @Column({
    name: 'budget_adequacy_grade',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  budgetAdequacyGrade: string | null;

  @Column({ name: 'process_adequacy', type: 'text', nullable: true })
  processAdequacy: string | null;

  @Column({
    name: 'process_adequacy_grade',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  processAdequacyGrade: string | null;

  @Column({ name: 'kpi_adequacy', type: 'text', nullable: true })
  kpiAdequacy: string | null;

  @Column({
    name: 'kpi_adequacy_grade',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  kpiAdequacyGrade: string | null;

  @Column({ name: 'survey_items', type: 'jsonb', nullable: true })
  surveyItems: SpSurveyItemJson[] | null;

  @Column({ name: 'survey_plans', type: 'jsonb', nullable: true })
  surveyPlans: SpSurveyPlanJson[] | null;

  /** ⑤ 만족도 세부항목 — 해당 없음 */
  @Column({ name: 'survey_items_na', type: 'boolean', default: false })
  surveyItemsNa: boolean;

  /** ⑤ 대학만족도조사 외 조사 — 해당 없음 */
  @Column({ name: 'survey_plans_na', type: 'boolean', default: false })
  surveyPlansNa: boolean;

  /** IR평가 모드에서 작성한 첨삭·추가 의견 */
  @Column({ name: 'ir_eval', type: 'jsonb', nullable: true })
  irEval: SpIrEvalJson | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 50, nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
