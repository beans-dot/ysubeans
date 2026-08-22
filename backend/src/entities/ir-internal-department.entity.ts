import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { IrInternalSeries } from './ir-internal-series.entity';

/**
 * 자체 경쟁력용 연성대 학과.
 * ir_raw_data.dept_code 와 코드로 연결되므로 이름은 바꿔도 기존 업로드 데이터가 유지된다.
 */
@Unique('uq_internal_dept_univ_code', ['univCode', 'deptCode'])
@Entity('ir_internal_department')
export class IrInternalDepartment {
  @PrimaryGeneratedColumn({ name: 'dept_pk' })
  deptPk: number;

  @Index()
  @Column({ name: 'univ_code', type: 'varchar', length: 50 })
  univCode: string;

  @Column({ name: 'dept_code', type: 'varchar', length: 100 })
  deptCode: string;

  @Column({ name: 'dept_name', type: 'varchar', length: 300 })
  deptName: string;

  @Column({ name: 'series_id', type: 'int' })
  seriesId: number;

  @ManyToOne(() => IrInternalSeries, (s) => s.departments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'series_id' })
  series: IrInternalSeries;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}
