import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AnnualEventCategory = 'YSU' | 'EXTERNAL';

@Entity('ir_annual_event')
export class IrAnnualEvent {
  @PrimaryGeneratedColumn({ name: 'event_id' })
  eventId: number;

  @Index()
  @Column({ name: 'year', type: 'int' })
  year: number;

  /** 'YSU' = 연성대학교, 'EXTERNAL' = 대학 외 */
  @Column({ name: 'category', type: 'varchar', length: 20 })
  category: AnnualEventCategory;

  @Column({ name: 'content', type: 'text' })
  content: string;

  /** manual = 관리자 입력, org = 조직관리에서 자동 생성 */
  @Column({ name: 'source', type: 'varchar', length: 20, default: 'manual' })
  source: string;

  /** 조직관리가 마지막으로 만든 원문. 사용자 수정 여부 판별용. */
  @Column({ name: 'auto_content', type: 'text', nullable: true })
  autoContent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
