import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ir_update_log')
export class IrUpdateLog {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  logId: number;

  @Column({ name: 'update_date', type: 'timestamptz', default: () => 'now()' })
  updateDate: Date;

  // 'ALIMI_BATCH' | 'EXCEL_UPLOAD' | 'MANUAL' 등
  @Column({ name: 'update_type', type: 'varchar', length: 50 })
  updateType: string;

  @Column({ name: 'log_text', type: 'text' })
  logText: string;
}
