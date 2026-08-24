import { Column, Entity, PrimaryColumn } from 'typeorm';

/** 발전전략 (A~E) */
@Entity('ir_sp_goal')
export class IrSpGoal {
  @PrimaryColumn({ name: 'goal_id', type: 'varchar', length: 10 })
  goalId: string;

  @Column({ name: 'goal_no', type: 'int', default: 0 })
  goalNo: number;

  @Column({ name: 'goal_name', type: 'varchar', length: 300 })
  goalName: string;
}
