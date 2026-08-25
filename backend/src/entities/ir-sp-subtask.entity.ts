import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** 세부과제(TASK). subtask_code는 안정 코드(A11-1). */
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

  @Column({ name: 'hangul_code', type: 'varchar', length: 40, default: '' })
  hangulCode: string;

  @Column({ name: 'seq_no', type: 'int', default: 1 })
  seqNo: number;

  @Column({ name: 'subtask_name', type: 'varchar', length: 400 })
  subtaskName: string;

  @Column({ name: 'purpose', type: 'text', nullable: true })
  purpose: string | null;

  @Column({ name: 'method', type: 'text', nullable: true })
  method: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'effective_from', type: 'int', default: 2022 })
  effectiveFrom: number;

  @Column({ name: 'abolished_from', type: 'int', nullable: true })
  abolishedFrom: number | null;
}
