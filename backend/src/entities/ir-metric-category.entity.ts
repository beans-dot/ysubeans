import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { IrMetricRegistry } from './ir-metric-registry.entity';

@Entity('ir_metric_category')
export class IrMetricCategory {
  @PrimaryGeneratedColumn({ name: 'category_id' })
  categoryId: number;

  @Column({ name: 'category_name', type: 'varchar', length: 200 })
  categoryName: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @OneToMany(() => IrMetricRegistry, (metric) => metric.category)
  metrics: IrMetricRegistry[];
}
