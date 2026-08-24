import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export interface SpCompareGroup {
  N?: number;
  mean?: number | null;
  median?: number | null;
  ysu?: number | null;
  rank?: number | null;
  b5?: number | null;
  top5?: boolean;
}

/** 지표·연도별 공시 비교값 (jc = 전문대, un = 4년제, al = 전체) */
export interface SpComparePayload {
  jc?: SpCompareGroup;
  un?: SpCompareGroup;
  al?: SpCompareGroup;
}

/** 전임교원 확보율처럼 병기 지표가 있는 경우 */
export interface SpCompareAlt {
  label: string;
  value: SpCompareGroup;
}

/** 대학알리미 주요지표 비교 데이터 */
@Entity('ir_sp_compare_data')
@Unique('uq_sp_compare_data', ['indicatorId', 'year'])
export class IrSpCompareData {
  @PrimaryGeneratedColumn({ name: 'compare_id' })
  compareId: number;

  @Index()
  @Column({ name: 'indicator_id', type: 'varchar', length: 30 })
  indicatorId: string;

  @Column({ name: 'indicator_name', type: 'varchar', length: 200 })
  indicatorName: string;

  @Column({ name: 'src', type: 'text', nullable: true })
  src: string | null;

  @Column({ name: 'src_label', type: 'text', nullable: true })
  srcLabel: string | null;

  /** 사립대 기준 공시값 여부 */
  @Column({ name: 'is_private_basis', type: 'boolean', default: false })
  isPrivateBasis: boolean;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({ name: 'payload', type: 'jsonb' })
  payload: SpComparePayload;

  @Column({ name: 'alt_payload', type: 'jsonb', nullable: true })
  altPayload: SpCompareAlt | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}
