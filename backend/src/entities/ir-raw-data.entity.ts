import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { IrMetricRegistry } from './ir-metric-registry.entity';

// [Performance 치명적] 피벗 연산 속도를 위한 복합 인덱스 (year, univ_code, metric_id)
@Index('idx_raw_year_univ_metric', ['year', 'univCode', 'metricId'])
// Upsert(ON CONFLICT) 기준 유니크 제약 (year, univ_code, dept_code, metric_id)
@Unique('uq_raw_year_univ_dept_metric', ['year', 'univCode', 'deptCode', 'metricId'])
@Entity('ir_raw_data')
export class IrRawData {
  @PrimaryGeneratedColumn({ name: 'raw_id' })
  rawId: number;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({ name: 'univ_code', type: 'varchar', length: 50 })
  univCode: string;

  // dept_code는 대학 단위 지표의 경우 존재하지 않으므로 '_ALL_' 센티넬 사용 (유니크 제약 NULL 회피)
  @Column({ name: 'dept_code', type: 'varchar', length: 50, default: '_ALL_' })
  deptCode: string;

  @Column({ name: 'metric_id', type: 'int' })
  metricId: number;

  @ManyToOne(() => IrMetricRegistry, (metric) => metric.rawData, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'metric_id' })
  metric: IrMetricRegistry;

  // 숫자 0 및 문자열 'NULL' 표기를 모두 담기 위해 문자열로 원본 저장
  @Column({ name: 'metric_value', type: 'varchar', length: 100 })
  metricValue: string;

  // 마감 데이터 잠금 (Upload 2차 경고 트리거)
  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;
}
