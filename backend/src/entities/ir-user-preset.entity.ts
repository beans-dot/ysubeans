import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ir_user_preset')
export class IrUserPreset {
  @PrimaryGeneratedColumn({ name: 'preset_id' })
  presetId: number;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 100, default: 'default' })
  userId: string;

  @Column({ name: 'preset_name', type: 'varchar', length: 200 })
  presetName: string;

  @Column({ name: 'saved_filter_json', type: 'jsonb' })
  savedFilterJson: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
