import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ir_sp_item_version')
@Index('idx_sp_item_version_lookup', ['kind', 'lineageId', 'effectiveFrom'])
export class IrSpItemVersion {
  @PrimaryGeneratedColumn({ name: 'version_id' })
  versionId: number;

  @Column({ name: 'kind', type: 'varchar', length: 20 })
  kind: string;

  @Column({ name: 'lineage_id', type: 'varchar', length: 80 })
  lineageId: string;

  @Column({ name: 'alpha_code', type: 'varchar', length: 40 })
  alphaCode: string;

  @Column({ name: 'display_code', type: 'varchar', length: 80 })
  displayCode: string;

  @Column({ name: 'effective_from', type: 'int' })
  effectiveFrom: number;

  @Column({ name: 'effective_to', type: 'int', nullable: true })
  effectiveTo: number | null;

  @Column({ name: 'payload', type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ name: 'change_type', type: 'varchar', length: 20 })
  changeType: string;

  @Column({ name: 'changed_by', type: 'varchar', length: 50, nullable: true })
  changedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
