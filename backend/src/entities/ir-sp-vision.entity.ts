import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface SpMottoPair {
  motto: string;
  talent: string;
}

export interface SpTalent3C {
  name: string;
  items: string[];
}

/** 중장기발전계획 비전 체계. 단일 레코드로 운영한다. */
@Entity('ir_sp_vision')
export class IrSpVision {
  @PrimaryGeneratedColumn({ name: 'vision_id' })
  visionId: number;

  @Column({ name: 'official_name', type: 'varchar', length: 300, nullable: true })
  officialName: string | null;

  @Column({ name: 'plan_period', type: 'varchar', length: 200, nullable: true })
  planPeriod: string | null;

  @Column({ name: 'structure_summary', type: 'text', nullable: true })
  structureSummary: string | null;

  @Column({ name: 'vision_statement', type: 'text', nullable: true })
  visionStatement: string | null;

  @Column({ name: 'vision_goal', type: 'text', nullable: true })
  visionGoal: string | null;

  @Column({ name: 'mission', type: 'text', nullable: true })
  mission: string | null;

  /** 8대 주요지표 */
  @Column({ name: 'key_indicators', type: 'jsonb', nullable: true })
  keyIndicators: string[] | null;

  /** 건학이념 */
  @Column({ name: 'founding_philosophy', type: 'jsonb', nullable: true })
  foundingPhilosophy: string[] | null;

  /** 교훈·인재상 쌍 */
  @Column({ name: 'motto_pairs', type: 'jsonb', nullable: true })
  mottoPairs: SpMottoPair[] | null;

  /** 3C형 인재 */
  @Column({ name: 'talent_3c', type: 'jsonb', nullable: true })
  talent3c: SpTalent3C | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
