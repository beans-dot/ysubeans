import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ir_org_change_log')
@Index('idx_org_change_log_year', ['year'])
export class IrOrgChangeLog {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  logId: number;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({ name: 'kind', type: 'varchar', length: 20 })
  kind: string;

  @Column({ name: 'lineage_id', type: 'varchar', length: 80 })
  lineageId: string;

  @Column({ name: 'display_name', type: 'varchar', length: 300 })
  displayName: string;

  @Column({ name: 'change_type', type: 'varchar', length: 20 })
  changeType: string;

  @Column({ name: 'summary', type: 'varchar', length: 400 })
  summary: string;

  @Column({ name: 'before_payload', type: 'jsonb', nullable: true })
  beforePayload: Record<string, unknown> | null;

  @Column({ name: 'after_payload', type: 'jsonb', nullable: true })
  afterPayload: Record<string, unknown> | null;

  @Column({ name: 'changed_by', type: 'varchar', length: 50, nullable: true })
  changedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
