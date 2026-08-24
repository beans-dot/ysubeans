import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** 실행과제별 연도 자체평가 (부서 자체평가 + IR센터 평가) */
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

  /** 추진실적 요약 */
  @Column({ name: 'dept_summary', type: 'text', nullable: true })
  deptSummary: string | null;

  /** 부서 자체분석 및 개선 방향 */
  @Column({ name: 'dept_analysis', type: 'text', nullable: true })
  deptAnalysis: string | null;

  /** 부서 자체점검 등급 */
  @Column({ name: 'dept_grade', type: 'varchar', length: 20, nullable: true })
  deptGrade: string | null;

  /** 개선·환류 사항 */
  @Column({ name: 'dept_improvement', type: 'text', nullable: true })
  deptImprovement: string | null;

  /** IR센터 평가 등급 */
  @Column({ name: 'ir_grade', type: 'varchar', length: 20, nullable: true })
  irGrade: string | null;

  /** IR센터 기타 의견 및 환류 사항 */
  @Column({ name: 'ir_feedback', type: 'text', nullable: true })
  irFeedback: string | null;

  /** 만족도조사 기반 자체평가 — 자체점검 등급 */
  @Column({ name: 'survey_grade', type: 'varchar', length: 20, nullable: true })
  surveyGrade: string | null;

  /** 만족도 조사 결과 분석과 개선 */
  @Column({ name: 'survey_analysis', type: 'text', nullable: true })
  surveyAnalysis: string | null;

  /** 만족도조사 환류사항 */
  @Column({ name: 'survey_feedback', type: 'text', nullable: true })
  surveyFeedback: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 50, nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
