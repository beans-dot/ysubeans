import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type SpFullRevisionScope = 'structure' | 'kpi' | 'fund';

/** 중장기발전계획 전면개정. n학년도부터 공란, n-1학년도 시점은 조회로 남긴다. */
@Entity('ir_sp_full_revision')
@Index('idx_sp_full_revision_year', ['year'])
export class IrSpFullRevision {
  @PrimaryGeneratedColumn({ name: 'revision_id' })
  revisionId: number;

  /** 전면개정이 적용되는 학년도(n) */
  @Column({ name: 'year', type: 'int' })
  year: number;

  /** 공란 직전 분기(n-1) */
  @Column({ name: 'snapshot_year', type: 'int' })
  snapshotYear: number;

  @Column({ name: 'scope', type: 'varchar', length: 20 })
  scope: SpFullRevisionScope;

  @Column({ name: 'created_by', type: 'varchar', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
