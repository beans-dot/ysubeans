import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';

/** 성과지표(KPI). kpi_code는 최초 부여한 안정 PK이며, 화면 코드는 suffix로 표시한다. */
@Entity('ir_sp_kpi')
export class IrSpKpi {
  @PrimaryColumn({ name: 'kpi_code', type: 'varchar', length: 30 })
  kpiCode: string;

  @Column({ name: 'kpi_name', type: 'varchar', length: 300 })
  kpiName: string;

  @Column({ name: 'unit', type: 'varchar', length: 30, nullable: true })
  unit: string | null;

  @Index()
  @Column({ name: 'task_code', type: 'varchar', length: 60, nullable: true })
  taskCode: string | null;

  @Index()
  @Column({ name: 'strategy_id', type: 'varchar', length: 20, nullable: true })
  strategyId: string | null;

  @Index()
  @Column({ name: 'goal_id', type: 'varchar', length: 10, nullable: true })
  goalId: string | null;

  @Column({ name: 'primary_dept', type: 'varchar', length: 100, nullable: true })
  primaryDept: string | null;

  @Column({
    name: 'baseline',
    type: 'numeric',
    nullable: true,
    transformer: numericTransformer,
  })
  baseline: number | null;

  @Column({ name: 'baseline_ref', type: 'varchar', length: 200, nullable: true })
  baselineRef: string | null;

  @Column({ name: 'formula', type: 'text', nullable: true })
  formula: string | null;

  @Column({ name: 'source', type: 'text', nullable: true })
  source: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  /** 표시용 소문자. PK(kpi_code)는 최초 부여값을 유지한다. */
  @Column({ name: 'suffix', type: 'varchar', length: 1, nullable: true })
  suffix: string | null;

  @Column({ name: 'effective_from', type: 'int', default: 2022 })
  effectiveFrom: number;

  @Column({ name: 'abolished_from', type: 'int', nullable: true })
  abolishedFrom: number | null;
}
