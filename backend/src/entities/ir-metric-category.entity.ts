import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  IrMetricRegistry,
  type MetricSourceType,
} from './ir-metric-registry.entity';

@Entity('ir_metric_category')
export class IrMetricCategory {
  @PrimaryGeneratedColumn({ name: 'category_id' })
  categoryId: number;

  /**
   * 시드 카테고리 고유 코드(모니터링 전용). 카테고리명을 바꿔도 유지된다.
   * 사용자 등록 카테고리는 null.
   */
  @Index()
  @Column({
    name: 'category_code',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  categoryCode: string | null;

  @Column({ name: 'category_name', type: 'varchar', length: 200 })
  categoryName: string;

  /**
   * ALIMI = 대학정보공시(dashboard)
   * INTERNAL = 대학자체데이터(competitiveness)
   * MONITORING = 대학주요모니터링
   */
  @Column({ name: 'source_type', type: 'varchar', length: 20, default: 'ALIMI' })
  sourceType: MetricSourceType;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  /** true면 트리 빌더에만 보이고 조회·지표선택 화면에서는 제외 */
  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden: boolean;

  @OneToMany(() => IrMetricRegistry, (metric) => metric.category)
  metrics: IrMetricRegistry[];
}
