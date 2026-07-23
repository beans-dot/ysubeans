import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'approved' | 'rejected';

@Entity('ir_user')
export class IrUser {
  @PrimaryColumn({ name: 'id', type: 'varchar', length: 50 })
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'email', type: 'varchar', length: 200, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 200 })
  passwordHash: string;

  @Column({ name: 'department', type: 'varchar', length: 200 })
  department: string;

  @Column({ name: 'extension', type: 'varchar', length: 50 })
  extension: string;

  @Column({ name: 'role', type: 'varchar', length: 20, default: 'user' })
  role: UserRole;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({
    name: 'approved_by',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  approvedBy: string | null;
}
