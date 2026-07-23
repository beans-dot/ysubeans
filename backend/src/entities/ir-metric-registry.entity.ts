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

export type MetricSourceType = 'ALIMI' | 'INTERNAL';

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

  @Column({ name: 'metric_name', type: 'varchar', length: 300 })
  metricName: string;

  @Column({ name: 'metric_unit', type: 'varchar', length: 50, nullable: true })
  metricUnit: string | null;

  @Column({ name: 'aggregation_type', type: 'varchar', length: 30, default: 'SUM' })
  aggregationType: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @OneToMany(() => IrRawData, (raw) => raw.metric)
  rawData: IrRawData[];
}
