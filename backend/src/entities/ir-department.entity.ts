import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

// 대학별 학과(교육편제) 정보. 폐과 포함 원본에서 운영중(is_active=true)만 트리 노드로 사용.
@Unique('uq_dept_univ_code', ['univCode', 'deptCode'])
@Entity('ir_department')
export class IrDepartment {
  @PrimaryGeneratedColumn({ name: 'dept_pk' })
  deptPk: number;

  @Index()
  @Column({ name: 'univ_code', type: 'varchar', length: 50 })
  univCode: string;

  @Column({ name: 'dept_code', type: 'varchar', length: 100 })
  deptCode: string;

  // 대계열 (대중소 계열 분류의 '대계열')
  @Column({ name: 'series_lg', type: 'varchar', length: 100, nullable: true })
  seriesLg: string | null;

  @Column({ name: 'dept_name', type: 'varchar', length: 300 })
  deptName: string;

  // 운영 상태: 폐과·폐지 등 제외 위한 플래그('통합'은 활성 유지)
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
