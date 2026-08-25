import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  IrDataAuditLog,
  IrDepartment,
  IrRawData,
  IrUniversityMaster,
  type MetricSourceType,
} from '../../entities';
import { InternalOrgService } from '../internal-org/internal-org.service';

export type EditableSourceType = Extract<
  MetricSourceType,
  'INTERNAL' | 'MONITORING'
>;

export interface RawCorrectionItem {
  rawId: number;
  year: number;
  univCode: string;
  univName: string;
  deptCode: string;
  deptName: string;
  metricId: number;
  metricName: string;
  metricValue: string;
  isLocked: boolean;
}

function isEditableSource(
  sourceType?: MetricSourceType | null,
): sourceType is EditableSourceType {
  return sourceType === 'INTERNAL' || sourceType === 'MONITORING';
}

const ALIMI_RESTRICTED_MESSAGE =
  '대학 자체 데이터와 대학주요모니터링 데이터만 수정·삭제할 수 있습니다. 정보공시(ALIMI) 데이터는 수정이 제한됩니다.';

@Injectable()
export class RawCorrectionService {
  private readonly ysuCode = process.env.YSU_UNIV_CODE || '0002651';

  constructor(
    @InjectRepository(IrRawData)
    private readonly rawRepo: Repository<IrRawData>,
    @InjectRepository(IrUniversityMaster)
    private readonly univRepo: Repository<IrUniversityMaster>,
    @InjectRepository(IrDepartment)
    private readonly deptRepo: Repository<IrDepartment>,
    private readonly dataSource: DataSource,
    private readonly internalOrg: InternalOrgService,
  ) {}

  private deptKey(univCode: string, deptCode: string) {
    return `${univCode}::${deptCode}`;
  }

  private async resolveNames(
    rows: Array<{ univCode: string; deptCode: string }>,
  ): Promise<{
    univNameByCode: Map<string, string>;
    deptNameByKey: Map<string, string>;
  }> {
    const univCodes = [...new Set(rows.map((r) => r.univCode).filter(Boolean))];
    const deptCodes = [
      ...new Set(
        rows.map((r) => r.deptCode).filter((c) => c && c !== '_ALL_'),
      ),
    ];

    const [univs, depts] = await Promise.all([
      univCodes.length > 0
        ? this.univRepo.find({ where: { univCode: In(univCodes) } })
        : Promise.resolve([] as IrUniversityMaster[]),
      univCodes.length > 0 && deptCodes.length > 0
        ? this.deptRepo.find({
            where: { univCode: In(univCodes), deptCode: In(deptCodes) },
          })
        : Promise.resolve([] as IrDepartment[]),
    ]);

    const univNameByCode = new Map(univs.map((u) => [u.univCode, u.univName]));
    const deptNameByKey = new Map(
      depts.map((d) => [this.deptKey(d.univCode, d.deptCode), d.deptName]),
    );

    try {
      const overlay = await this.internalOrg.getDeptNameMap(this.ysuCode);
      overlay.forEach((name, key) => deptNameByKey.set(key, name));
    } catch {
      // 자체 편제 조회 실패 시 공시 학과명 사용
    }

    return { univNameByCode, deptNameByKey };
  }

  private toItem(
    r: IrRawData,
    univNameByCode: Map<string, string>,
    deptNameByKey: Map<string, string>,
    metricValue?: string,
  ): RawCorrectionItem {
    return {
      rawId: r.rawId,
      year: r.year,
      univCode: r.univCode,
      univName: univNameByCode.get(r.univCode) ?? '',
      deptCode: r.deptCode,
      deptName:
        r.deptCode === '_ALL_'
          ? '대학 전체'
          : (deptNameByKey.get(this.deptKey(r.univCode, r.deptCode)) ?? ''),
      metricId: r.metricId,
      metricName: r.metric.metricName,
      metricValue: metricValue ?? r.metricValue,
      isLocked: r.isLocked,
    };
  }

  private async toItemWithNames(
    row: IrRawData,
    metricValue?: string,
  ): Promise<RawCorrectionItem> {
    const { univNameByCode, deptNameByKey } = await this.resolveNames([row]);
    return this.toItem(row, univNameByCode, deptNameByKey, metricValue);
  }

  async listYears(sourceType: EditableSourceType): Promise<number[]> {
    const rows = await this.rawRepo
      .createQueryBuilder('r')
      .innerJoin('r.metric', 'm')
      .select('r.year', 'year')
      .distinct(true)
      .where('m.sourceType = :sourceType', { sourceType })
      .orderBy('r.year', 'DESC')
      .getRawMany<{ year: string | number }>();

    return rows.map((row) => Number(row.year)).filter((y) => Number.isFinite(y));
  }

  async list(params: {
    year: number;
    sourceType: EditableSourceType;
    univCode?: string;
    deptCode?: string;
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{ total: number; items: RawCorrectionItem[] }> {
    const qb = this.rawRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.metric', 'm')
      .where('m.sourceType = :sourceType', { sourceType: params.sourceType })
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

    const { univNameByCode, deptNameByKey } = await this.resolveNames(rows);

    return {
      total,
      items: rows.map((r) => this.toItem(r, univNameByCode, deptNameByKey)),
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
    if (!row.metric || !isEditableSource(row.metric.sourceType)) {
      throw new ForbiddenException(ALIMI_RESTRICTED_MESSAGE);
    }

    const nextValue = metricValue.trim();
    if (row.metricValue === nextValue) {
      return this.toItemWithNames(row);
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

    return this.toItemWithNames(row, nextValue);
  }

  /**
   * 대학 자체(INTERNAL)·대학주요모니터링(MONITORING) 원시 데이터 하드 삭제.
   * 감사 로그에 newMetricValue='[DELETED]' 로 남긴다.
   */
  async removeMany(
    rawIds: number[],
    clientIp: string | null,
  ): Promise<{ deleted: number }> {
    const uniqueIds = [
      ...new Set(
        rawIds.filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
    if (uniqueIds.length === 0) {
      throw new NotFoundException('삭제할 데이터를 찾을 수 없습니다.');
    }

    const rows = await this.rawRepo.find({
      where: { rawId: In(uniqueIds) },
      relations: { metric: true },
    });

    const allowed = rows.filter(
      (r) => r.metric && isEditableSource(r.metric.sourceType),
    );
    if (allowed.length === 0) {
      throw new NotFoundException('삭제할 데이터를 찾을 수 없습니다.');
    }

    const allowedIds = new Set(allowed.map((r) => r.rawId));
    const rejected = uniqueIds.filter((id) => !allowedIds.has(id));
    if (rejected.length > 0) {
      throw new ForbiddenException(
        `${ALIMI_RESTRICTED_MESSAGE} 대상 외 rawId: ${rejected.join(', ')}`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      for (const row of allowed) {
        await manager.insert(IrDataAuditLog, {
          year: row.year,
          univCode: row.univCode,
          deptCode: row.deptCode,
          metricId: row.metricId,
          metricName: row.metric.metricName,
          oldMetricValue: row.metricValue,
          newMetricValue: '[DELETED]',
          clientIp,
        });
      }
      await manager.delete(IrRawData, {
        rawId: In(allowed.map((r) => r.rawId)),
      });
    });

    return { deleted: allowed.length };
  }
}
