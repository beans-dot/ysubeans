import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** 중장기발전계획 실행과제의 책임·연관부서 마스터. 관리자가 추가·수정한다. */
@Entity('ir_sp_department')
@Unique('uq_sp_department_name', ['deptName'])
export class IrSpDepartment {
  @PrimaryGeneratedColumn({ name: 'dept_id' })
  deptId: number;

  @Column({ name: 'dept_name', type: 'varchar', length: 100 })
  deptName: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}
