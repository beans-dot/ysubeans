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
