import { Column, Entity, PrimaryColumn } from 'typeorm';

/** 발전전략 (A~E). goal_id는 안정 코드(A). */
@Entity('ir_sp_goal')
export class IrSpGoal {
  @PrimaryColumn({ name: 'goal_id', type: 'varchar', length: 10 })
  goalId: string;

  @Column({ name: 'goal_no', type: 'int', default: 0 })
  goalNo: number;

  @Column({ name: 'goal_name', type: 'varchar', length: 300 })
  goalName: string;

  @Column({ name: 'effective_from', type: 'int', default: 2022 })
  effectiveFrom: number;

  @Column({ name: 'abolished_from', type: 'int', nullable: true })
  abolishedFrom: number | null;
}
