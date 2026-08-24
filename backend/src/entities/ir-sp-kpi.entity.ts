import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';

/** 성과지표(KPI) */
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
}
