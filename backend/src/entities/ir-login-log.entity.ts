import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ir_login_log')
export class IrLoginLog {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  logId: number;

  @Column({ name: 'user_id', type: 'varchar', length: 50 })
  userId: string;

  @Column({ name: 'success', type: 'boolean' })
  success: boolean;

  @Column({ name: 'ip', type: 'varchar', length: 100, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({
    name: 'fail_reason',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  failReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
