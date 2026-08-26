import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IrInternalDepartment } from './ir-internal-department.entity';

/** 자체 경쟁력(competitiveness)용 연성대 계열. 공시 ir_department와 분리. */
@Entity('ir_internal_series')
export class IrInternalSeries {
  @PrimaryGeneratedColumn({ name: 'series_id' })
  seriesId: number;

  @Index()
  @Column({ name: 'univ_code', type: 'varchar', length: 50 })
  univCode: string;

  @Column({ name: 'series_code', type: 'varchar', length: 40, nullable: true })
  seriesCode: string | null;

  @Column({ name: 'series_name', type: 'varchar', length: 200 })
  seriesName: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'effective_from', type: 'int', default: 2018 })
  effectiveFrom: number;

  @Column({ name: 'abolished_from', type: 'int', nullable: true })
  abolishedFrom: number | null;

  @OneToMany(() => IrInternalDepartment, (d) => d.series)
  departments: IrInternalDepartment[];
}
