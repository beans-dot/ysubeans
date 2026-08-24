import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from './numeric.transformer';

/** KPI 연도별 실적값 */
@Entity('ir_sp_kpi_result')
@Unique('uq_sp_kpi_result', ['kpiCode', 'year'])
export class IrSpKpiResult {
  @PrimaryGeneratedColumn({ name: 'result_id' })
  resultId: number;

  @Index()
  @Column({ name: 'kpi_code', type: 'varchar', length: 30 })
  kpiCode: string;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({
    name: 'actual_value',
    type: 'numeric',
    nullable: true,
    transformer: numericTransformer,
  })
  actualValue: number | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 50, nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
