import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** 엑셀 업로드 등에서 이력 펼침용으로 남기는 지표·학과 요약 */
export interface UpdateLogMetricDetail {
  metricName: string;
  isNew: boolean;
  /** 대표 학과명. 대학 전체(_ALL_)만 있으면 null */
  sampleDept: string | null;
  deptCount: number;
}

export interface UpdateLogDetail {
  metrics: UpdateLogMetricDetail[];
}

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

  @Column({ name: 'detail', type: 'jsonb', nullable: true })
  detail: UpdateLogDetail | null;
}
