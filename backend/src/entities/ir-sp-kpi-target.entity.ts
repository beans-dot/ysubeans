import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { numericTransformer } from './numeric.transformer';

/** KPI 연도별 목표치 */
@Entity('ir_sp_kpi_target')
@Unique('uq_sp_kpi_target', ['kpiCode', 'year'])
export class IrSpKpiTarget {
  @PrimaryGeneratedColumn({ name: 'target_id' })
  targetId: number;

  @Index()
  @Column({ name: 'kpi_code', type: 'varchar', length: 30 })
  kpiCode: string;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({
    name: 'target_value',
    type: 'numeric',
    nullable: true,
    transformer: numericTransformer,
  })
  targetValue: number | null;
}
