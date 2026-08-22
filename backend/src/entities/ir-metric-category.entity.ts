import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { IrMetricRegistry } from './ir-metric-registry.entity';

@Entity('ir_metric_category')
export class IrMetricCategory {
  @PrimaryGeneratedColumn({ name: 'category_id' })
  categoryId: number;

  @Column({ name: 'category_name', type: 'varchar', length: 200 })
  categoryName: string;

  /** ALIMI = 대학정보공시(dashboard) / INTERNAL = 대학자체데이터(competitiveness) */
  @Column({ name: 'source_type', type: 'varchar', length: 20, default: 'ALIMI' })
  sourceType: 'ALIMI' | 'INTERNAL';

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @OneToMany(() => IrMetricRegistry, (metric) => metric.category)
  metrics: IrMetricRegistry[];
}
