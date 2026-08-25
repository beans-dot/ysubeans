import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** 예산·결산 재원 유형. 관리자가 추가·수정한다. */
@Entity('ir_sp_fund_source')
@Unique('uq_sp_fund_source_name', ['fundSourceName'])
export class IrSpFundSource {
  @PrimaryGeneratedColumn({ name: 'fund_source_id' })
  fundSourceId: number;

  @Column({ name: 'fund_source_name', type: 'varchar', length: 100 })
  fundSourceName: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  /** 사용 중이라 삭제할 수 없는 재원은 비활성으로 감춘다. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'effective_from', type: 'int', default: 2022 })
  effectiveFrom: number;

  @Column({ name: 'abolished_from', type: 'int', nullable: true })
  abolishedFrom: number | null;
}
