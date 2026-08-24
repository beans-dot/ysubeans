import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** 세부과제(TASK) */
@Entity('ir_sp_subtask')
@Unique('uq_sp_subtask_task_code', ['taskCode', 'subtaskCode'])
export class IrSpSubtask {
  @PrimaryGeneratedColumn({ name: 'subtask_id' })
  subtaskId: number;

  @Index()
  @Column({ name: 'task_code', type: 'varchar', length: 60 })
  taskCode: string;

  @Column({ name: 'subtask_code', type: 'varchar', length: 80 })
  subtaskCode: string;

  @Column({ name: 'subtask_name', type: 'varchar', length: 400 })
  subtaskName: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}
