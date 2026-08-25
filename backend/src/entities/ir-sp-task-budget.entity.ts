import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from './numeric.transformer';

/** TASK(세부과제) × 연도 × 재원 단위 예산·결산 (단위: 원) */
@Entity('ir_sp_task_budget')
@Unique('uq_sp_subtask_budget', [
  'taskCode',
  'subtaskCode',
  'year',
  'fundSourceId',
])
export class IrSpTaskBudget {
  @PrimaryGeneratedColumn({ name: 'budget_id' })
  budgetId: number;

  @Index()
  @Column({ name: 'task_code', type: 'varchar', length: 60 })
  taskCode: string;

  /** 세부 TASK 코드. 세부과제가 없으면 실행과제 코드를 그대로 쓴다. */
  @Index()
  @Column({
    name: 'subtask_code',
    type: 'varchar',
    length: 80,
    default: '',
  })
  subtaskCode: string;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Index()
  @Column({ name: 'fund_source_id', type: 'int' })
  fundSourceId: number;

  @Column({
    name: 'budget_amount',
    type: 'numeric',
    precision: 18,
    scale: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  budgetAmount: number | null;

  @Column({
    name: 'settlement_amount',
    type: 'numeric',
    precision: 18,
    scale: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  settlementAmount: number | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 50, nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
