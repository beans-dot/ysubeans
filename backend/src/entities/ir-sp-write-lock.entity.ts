import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** 실행과제 × 학년도 예결산·자체평가 작성완료 잠금 */
@Entity('ir_sp_write_lock')
@Unique('uq_sp_write_lock', ['taskCode', 'year'])
export class IrSpWriteLock {
  @PrimaryGeneratedColumn({ name: 'lock_id' })
  lockId: number;

  @Column({ name: 'task_code', type: 'varchar', length: 60 })
  taskCode: string;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({ name: 'budget_completed', type: 'boolean', default: false })
  budgetCompleted: boolean;

  @Column({ name: 'eval_completed', type: 'boolean', default: false })
  evalCompleted: boolean;

  @Column({ name: 'updated_by', type: 'varchar', length: 50, nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
