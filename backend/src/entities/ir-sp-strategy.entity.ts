import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 전략과제 (A1, A2 …). strategy_id는 안정 코드. */
@Entity('ir_sp_strategy')
export class IrSpStrategy {
  @PrimaryColumn({ name: 'strategy_id', type: 'varchar', length: 20 })
  strategyId: string;

  @Index()
  @Column({ name: 'goal_id', type: 'varchar', length: 10 })
  goalId: string;

  @Column({ name: 'strategy_name', type: 'varchar', length: 300 })
  strategyName: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'effective_from', type: 'int', default: 2022 })
  effectiveFrom: number;

  @Column({ name: 'abolished_from', type: 'int', nullable: true })
  abolishedFrom: number | null;
}
