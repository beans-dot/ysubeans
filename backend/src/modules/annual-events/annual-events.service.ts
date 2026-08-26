import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AnnualEventCategory,
  IrAnnualEvent,
} from '../../entities/ir-annual-event.entity';
import { mergeOrgAnnualContent } from '../internal-org/org-annual-event';

const VALID_CATEGORIES: AnnualEventCategory[] = ['YSU', 'EXTERNAL'];

@Injectable()
export class AnnualEventsService {
  constructor(
    @InjectRepository(IrAnnualEvent)
    private readonly eventRepo: Repository<IrAnnualEvent>,
  ) {}

  async list(year?: number): Promise<IrAnnualEvent[]> {
    const where = year != null && Number.isFinite(year) ? { year } : {};
    return this.eventRepo.find({
      where,
      order: { year: 'DESC', category: 'ASC', eventId: 'ASC' },
    });
  }

  async create(data: {
    year: number;
    category: AnnualEventCategory;
    content: string;
  }): Promise<IrAnnualEvent> {
    this.validatePayload(data);
    return this.eventRepo.save(
      this.eventRepo.create({
        year: data.year,
        category: data.category,
        content: data.content.trim(),
      }),
    );
  }

  async update(
    eventId: number,
    data: Partial<{
      year: number;
      category: AnnualEventCategory;
      content: string;
    }>,
  ): Promise<IrAnnualEvent> {
    const event = await this.eventRepo.findOne({ where: { eventId } });
    if (!event) throw new NotFoundException('연간 변동사항을 찾을 수 없습니다.');

    if (data.year !== undefined) {
      if (!Number.isInteger(data.year) || data.year < 1900 || data.year > 2100) {
        throw new BadRequestException('유효한 연도를 입력하세요.');
      }
      event.year = data.year;
    }
    if (data.category !== undefined) {
      if (!VALID_CATEGORIES.includes(data.category)) {
        throw new BadRequestException(
          "category는 'YSU' 또는 'EXTERNAL' 이어야 합니다.",
        );
      }
      event.category = data.category;
    }
    if (data.content !== undefined) {
      const content = data.content.trim();
      if (!content) {
        throw new BadRequestException('변동사항 내용을 입력하세요.');
      }
      event.content = content;
    }

    return this.eventRepo.save(event);
  }

  /**
   * 조직관리 변경을 해당 학년도 [연성대학교] 한 행에 이어 붙인다.
   * [학과]/[행정부서] 구간은 이력에서 다시 만들고, 관리자가 적은 다른 문구는 남긴다.
   */
  async upsertOrgEvent(year: number, generated: string): Promise<void> {
    const rows = await this.eventRepo.find({
      where: { year, category: 'YSU' },
      order: { eventId: 'ASC' },
    });
    const canonical = rows[0];
    const extras = rows.slice(1);
    const nextGenerated = generated.trim();

    if (!nextGenerated) {
      if (canonical) {
        const next = mergeOrgAnnualContent(
          canonical.content,
          '',
          canonical.autoContent,
        );
        if (!next) {
          await this.eventRepo.delete(canonical.eventId);
        } else {
          canonical.content = next;
          canonical.autoContent = null;
          await this.eventRepo.save(canonical);
        }
      }
      await this.deleteRedundantOrgRows(extras);
      return;
    }

    if (!canonical) {
      await this.eventRepo.save(
        this.eventRepo.create({
          year,
          category: 'YSU',
          content: nextGenerated,
          source: 'org',
          autoContent: nextGenerated,
        }),
      );
      return;
    }

    canonical.content = mergeOrgAnnualContent(
      canonical.content,
      nextGenerated,
      canonical.autoContent,
    );
    canonical.autoContent = nextGenerated;
    canonical.source = 'org';
    await this.eventRepo.save(canonical);
    await this.deleteRedundantOrgRows(extras);
  }

  /** 같은 학년도에 자동 생성된 [연성대학교] 중복 행만 걷어낸다. */
  private async deleteRedundantOrgRows(extras: IrAnnualEvent[]) {
    for (const row of extras) {
      const auto = (row.autoContent ?? '').trim();
      if (auto && row.content.trim() === auto) {
        await this.eventRepo.delete(row.eventId);
      }
    }
  }

  async remove(eventId: number): Promise<{ ok: true }> {
    const result = await this.eventRepo.delete(eventId);
    if (!result.affected) {
      throw new NotFoundException('연간 변동사항을 찾을 수 없습니다.');
    }
    return { ok: true };
  }

  private validatePayload(data: {
    year: number;
    category: AnnualEventCategory;
    content: string;
  }) {
    if (!Number.isInteger(data.year) || data.year < 1900 || data.year > 2100) {
      throw new BadRequestException('유효한 연도를 입력하세요.');
    }
    if (!VALID_CATEGORIES.includes(data.category)) {
      throw new BadRequestException(
        "category는 'YSU' 또는 'EXTERNAL' 이어야 합니다.",
      );
    }
    if (!data.content?.trim()) {
      throw new BadRequestException('변동사항 내용을 입력하세요.');
    }
  }
}
