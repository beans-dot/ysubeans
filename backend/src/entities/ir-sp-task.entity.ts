import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 실행과제 (A11-혁신 …) */
@Entity('ir_sp_task')
export class IrSpTask {
  @PrimaryColumn({ name: 'task_code', type: 'varchar', length: 60 })
  taskCode: string;

  @Column({ name: 'task_name', type: 'varchar', length: 400 })
  taskName: string;

  @Index()
  @Column({ name: 'strategy_id', type: 'varchar', length: 20 })
  strategyId: string;

  @Index()
  @Column({ name: 'goal_id', type: 'varchar', length: 10 })
  goalId: string;

  /** 대학특성화 연계과제 여부 */
  @Column({ name: 'is_specialized', type: 'boolean', default: false })
  isSpecialized: boolean;

  @Column({ name: 'primary_dept', type: 'varchar', length: 100, nullable: true })
  primaryDept: string | null;

  @Column({ name: 'related_depts', type: 'jsonb', nullable: true })
  relatedDepts: string[] | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}
