import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 중장기발전계획 실행과제의 책임·연관부서 마스터. 관리자가 추가·수정한다. */
@Entity('ir_sp_department')
export class IrSpDepartment {
  @PrimaryGeneratedColumn({ name: 'dept_id' })
  deptId: number;

  @Column({ name: 'office_code', type: 'varchar', length: 40, nullable: true })
  officeCode: string | null;

  @Column({ name: 'dept_name', type: 'varchar', length: 100 })
  deptName: string;

  /** true면 대분류(조회·책임단위 아님). 리프 부서만 선택 가능. */
  @Column({ name: 'is_category', type: 'boolean', default: false })
  isCategory: boolean;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  @ManyToOne(() => IrSpDepartment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent: IrSpDepartment | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'effective_from', type: 'int', default: 2018 })
  effectiveFrom: number;

  @Column({ name: 'abolished_from', type: 'int', nullable: true })
  abolishedFrom: number | null;
}
