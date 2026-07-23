import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IrDataAuditLog, IrRawData } from '../../entities';

export interface RawCorrectionItem {
  rawId: number;
  year: number;
  univCode: string;
  deptCode: string;
  metricId: number;
  metricName: string;
  metricValue: string;
  isLocked: boolean;
}

@Injectable()
export class RawCorrectionService {
  constructor(
    @InjectRepository(IrRawData)
    private readonly rawRepo: Repository<IrRawData>,
    private readonly dataSource: DataSource,
  ) {}

  async listYears(): Promise<number[]> {
    const rows = await this.rawRepo
      .createQueryBuilder('r')
      .innerJoin('r.metric', 'm')
      .select('r.year', 'year')
      .distinct(true)
      .where('m.sourceType = :sourceType', { sourceType: 'INTERNAL' })
      .orderBy('r.year', 'DESC')
      .getRawMany<{ year: string | number }>();

    return rows.map((row) => Number(row.year)).filter((y) => Number.isFinite(y));
  }

  async list(params: {
    year: number;
    univCode?: string;
    deptCode?: string;
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{ total: number; items: RawCorrectionItem[] }> {
    const qb = this.rawRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.metric', 'm')
      .where('m.sourceType = :sourceType', { sourceType: 'INTERNAL' })
      .andWhere('r.year = :year', { year: params.year });

    if (params.univCode) {
      qb.andWhere('r.univCode = :univCode', { univCode: params.univCode });
    }
    if (params.deptCode) {
      qb.andWhere('r.deptCode = :deptCode', { deptCode: params.deptCode });
    }
    if (params.q) {
      qb.andWhere('m.metricName ILIKE :q', { q: `%${params.q}%` });
    }

    qb.orderBy('r.univCode', 'ASC')
      .addOrderBy('r.deptCode', 'ASC')
      .addOrderBy('m.metricName', 'ASC')
      .addOrderBy('r.rawId', 'ASC');

    const total = await qb.getCount();
    const rows = await qb
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    return {
      total,
      items: rows.map((r) => ({
        rawId: r.rawId,
        year: r.year,
        univCode: r.univCode,
        deptCode: r.deptCode,
        metricId: r.metricId,
        metricName: r.metric.metricName,
        metricValue: r.metricValue,
        isLocked: r.isLocked,
      })),
    };
  }

  async updateValue(
    rawId: number,
    metricValue: string,
    clientIp: string | null,
  ): Promise<RawCorrectionItem> {
    const row = await this.rawRepo.findOne({
      where: { rawId },
      relations: { metric: true },
    });

    if (!row) {
      throw new NotFoundException('원시 데이터를 찾을 수 없습니다.');
    }
    if (!row.metric || row.metric.sourceType !== 'INTERNAL') {
      throw new ForbiddenException(
        '대학 자체 데이터만 수정할 수 있습니다. 정보공시(ALIMI) 데이터는 수정이 제한됩니다.',
      );
    }

    const nextValue = metricValue.trim();
    if (row.metricValue === nextValue) {
      return {
        rawId: row.rawId,
        year: row.year,
        univCode: row.univCode,
        deptCode: row.deptCode,
        metricId: row.metricId,
        metricName: row.metric.metricName,
        metricValue: row.metricValue,
        isLocked: row.isLocked,
      };
    }

    const oldValue = row.metricValue;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(IrRawData, { rawId }, { metricValue: nextValue });
      await manager.insert(IrDataAuditLog, {
        year: row.year,
        univCode: row.univCode,
        deptCode: row.deptCode,
        metricId: row.metricId,
        metricName: row.metric.metricName,
        oldMetricValue: oldValue,
        newMetricValue: nextValue,
        clientIp,
      });
    });

    return {
      rawId: row.rawId,
      year: row.year,
      univCode: row.univCode,
      deptCode: row.deptCode,
      metricId: row.metricId,
      metricName: row.metric.metricName,
      metricValue: nextValue,
      isLocked: row.isLocked,
    };
  }
}
