import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ir_data_audit_log')
export class IrDataAuditLog {
  @PrimaryGeneratedColumn({ name: 'audit_id' })
  auditId: number;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({ name: 'univ_code', type: 'varchar', length: 50 })
  univCode: string;

  @Column({ name: 'dept_code', type: 'varchar', length: 50 })
  deptCode: string;

  @Column({ name: 'metric_id', type: 'int' })
  metricId: number;

  @Column({ name: 'metric_name', type: 'varchar', length: 300 })
  metricName: string;

  @Column({ name: 'old_metric_value', type: 'varchar', length: 100 })
  oldMetricValue: string;

  @Column({ name: 'new_metric_value', type: 'varchar', length: 100 })
  newMetricValue: string;

  @Column({ name: 'client_ip', type: 'varchar', length: 100, nullable: true })
  clientIp: string | null;

  @CreateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
