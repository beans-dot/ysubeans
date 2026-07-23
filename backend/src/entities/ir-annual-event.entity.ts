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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
