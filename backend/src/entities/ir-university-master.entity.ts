import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('ir_university_master')
export class IrUniversityMaster {
  @PrimaryColumn({ name: 'univ_code', type: 'varchar', length: 50 })
  univCode: string;

  @Column({ name: 'univ_name', type: 'varchar', length: 200 })
  univName: string;

  // 학교종류: '전문대학' | '4년제'
  @Index()
  @Column({ name: 'school_type', type: 'varchar', length: 50, nullable: true })
  schoolType: string | null;

  // 권역: '수도권' | '비수도권'
  @Index()
  @Column({ name: 'region_type', type: 'varchar', length: 50, nullable: true })
  regionType: string | null;

  // 지역(시/도): 서울, 경기, 인천, 강원 ... 17개 광역 시/도
  @Index()
  @Column({ name: 'region_city', type: 'varchar', length: 50, nullable: true })
  regionCity: string | null;
}
