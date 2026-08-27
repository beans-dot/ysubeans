import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IrMetricCategory } from './ir-metric-category.entity';
import { IrRawData } from './ir-raw-data.entity';

export type MetricSourceType = 'ALIMI' | 'INTERNAL' | 'MONITORING';

@Entity('ir_metric_registry')
export class IrMetricRegistry {
  @PrimaryGeneratedColumn({ name: 'metric_id' })
  metricId: number;

  @Column({ name: 'category_id', type: 'int' })
  categoryId: number;

  @ManyToOne(() => IrMetricCategory, (category) => category.metrics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: IrMetricCategory;

  @Index()
  @Column({ name: 'source_type', type: 'varchar', length: 20 })
  sourceType: MetricSourceType;

  /**
   * 시드 지표 고유 코드(모니터링 전용). 지표명을 바꿔도 유지되며,
   * 시드 재적용·monitoring 화면 매칭의 기준이 된다. 사용자 등록 지표는 null.
   */
  @Index()
  @Column({ name: 'metric_code', type: 'varchar', length: 120, nullable: true })
  metricCode: string | null;

  @Column({ name: 'metric_name', type: 'varchar', length: 300 })
  metricName: string;

  @Column({ name: 'metric_unit', type: 'varchar', length: 50, nullable: true })
  metricUnit: string | null;

  @Column({ name: 'aggregation_type', type: 'varchar', length: 30, default: 'SUM' })
  aggregationType: string;

  /**
   * 하위지표 자동계산식. `{#metricId}` 와 사칙연산만 허용.
   * computeEnabled 가 true 일 때 조회 화면에서 이 식으로 값을 만든다.
   */
  @Column({ name: 'compute_formula', type: 'text', nullable: true })
  computeFormula: string | null;

  /** true면 원본 값 대신 하위지표 계산식을 조회에 사용 (하위 값이 없는 연도는 원본 폴백) */
  @Column({ name: 'compute_enabled', type: 'boolean', default: false })
  computeEnabled: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  /** true면 트리 빌더에만 보이고 조회·지표선택 화면에서는 제외 */
  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden: boolean;

  /** 상위 지표. 재학생 수·회계 수입/지출처럼 그룹 아래에 하위 지표를 둘 때 사용. */
  @Index()
  @Column({ name: 'parent_metric_id', type: 'int', nullable: true })
  parentMetricId: number | null;

  @ManyToOne(() => IrMetricRegistry, (metric) => metric.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_metric_id' })
  parent: IrMetricRegistry | null;

  @OneToMany(() => IrMetricRegistry, (metric) => metric.parent)
  children: IrMetricRegistry[];

  @OneToMany(() => IrRawData, (raw) => raw.metric)
  rawData: IrRawData[];
}
