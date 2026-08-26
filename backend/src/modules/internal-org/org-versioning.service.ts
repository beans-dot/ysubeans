import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { IrOrgChangeLog, IrOrgItemVersion } from '../../entities';
import {
  ORG_MIN_YEAR,
  ORG_MAX_YEAR,
  orgYears,
  versionCovers,
  type OrgChangeType,
  type OrgNodeKind,
} from './org.constants';

export function kindLabel(kind: OrgNodeKind): string {
  if (kind === 'series') return '계열';
  if (kind === 'department') return '학과';
  return '행정부서';
}

export function changeTypeLabel(type: OrgChangeType): string {
  if (type === 'create') return '신설';
  if (type === 'update') return '수정';
  if (type === 'abolish') return '폐지';
  return '롤백';
}

@Injectable()
export class OrgVersioningService {
  constructor(
    @InjectRepository(IrOrgItemVersion)
    private readonly versionRepo: Repository<IrOrgItemVersion>,
    @InjectRepository(IrOrgChangeLog)
    private readonly logRepo: Repository<IrOrgChangeLog>,
  ) {}

  assertYear(year: number) {
    if (!Number.isInteger(year) || year < ORG_MIN_YEAR || year > ORG_MAX_YEAR) {
      throw new BadRequestException(
        `적용 학년도는 ${ORG_MIN_YEAR}~${ORG_MAX_YEAR} 사이여야 합니다.`,
      );
    }
  }

  years() {
    return orgYears();
  }

  async overlayPayload(
    kind: OrgNodeKind,
    lineageId: string,
    year: number,
  ): Promise<Record<string, unknown> | null> {
    const rows = await this.versionRepo.find({
      where: { kind, lineageId },
      order: { effectiveFrom: 'DESC', versionId: 'DESC' },
    });
    const hit = rows.find((row) =>
      versionCovers(row.effectiveFrom, row.effectiveTo, year),
    );
    return hit?.payload ?? null;
  }

  async overlayMap(
    kind: OrgNodeKind,
    year: number,
  ): Promise<Map<string, Record<string, unknown>>> {
    const rows = await this.versionRepo.find({
      where: { kind },
      order: { effectiveFrom: 'DESC', versionId: 'DESC' },
    });
    const map = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      if (map.has(row.lineageId)) continue;
      if (versionCovers(row.effectiveFrom, row.effectiveTo, year)) {
        map.set(row.lineageId, row.payload);
      }
    }
    return map;
  }

  async recordChange(input: {
    year: number;
    kind: OrgNodeKind;
    lineageId: string;
    displayName: string;
    changeType: OrgChangeType;
    summary: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    userId?: string | null;
  }) {
    await this.logRepo.save(
      this.logRepo.create({
        year: input.year,
        kind: input.kind,
        lineageId: input.lineageId,
        displayName: input.displayName,
        changeType: input.changeType,
        summary: input.summary,
        beforePayload: input.before,
        afterPayload: input.after,
        changedBy: input.userId ?? null,
      }),
    );
  }

  async writeVersion(input: {
    kind: OrgNodeKind;
    lineageId: string;
    alphaCode: string;
    displayName: string;
    year: number;
    changeType: OrgChangeType;
    payload: Record<string, unknown>;
    previousPayload?: Record<string, unknown> | null;
    userId?: string | null;
  }) {
    const open = await this.versionRepo.find({
      where: {
        kind: input.kind,
        lineageId: input.lineageId,
        effectiveTo: IsNull(),
      },
      order: { effectiveFrom: 'DESC', versionId: 'DESC' },
    });
    const current = open[0];
    if (current) {
      const closeTo = input.year - 1;
      if (closeTo >= current.effectiveFrom) {
        current.effectiveTo = closeTo;
        await this.versionRepo.save(current);
      } else {
        await this.versionRepo.delete(current.versionId);
      }
    } else if (input.changeType === 'update' || input.changeType === 'abolish') {
      const historic = input.previousPayload ?? input.payload;
      if (input.year > ORG_MIN_YEAR) {
        await this.versionRepo.save(
          this.versionRepo.create({
            kind: input.kind,
            lineageId: input.lineageId,
            alphaCode: input.alphaCode,
            displayName: String(historic.name ?? input.displayName),
            effectiveFrom: ORG_MIN_YEAR,
            effectiveTo: input.year - 1,
            payload: historic,
            changeType: 'create',
            changedBy: input.userId ?? null,
          }),
        );
      }
    }
    if (input.changeType !== 'abolish') {
      await this.versionRepo.save(
        this.versionRepo.create({
          kind: input.kind,
          lineageId: input.lineageId,
          alphaCode: input.alphaCode,
          displayName: input.displayName,
          effectiveFrom: input.year,
          effectiveTo: null,
          payload: input.payload,
          changeType: input.changeType,
          changedBy: input.userId ?? null,
        }),
      );
    }
  }

  async listChanges() {
    const rows = await this.logRepo.find({
      order: { year: 'DESC', logId: 'DESC' },
    });
    return rows.map((row) => ({
      logId: row.logId,
      year: row.year,
      kind: row.kind,
      kindLabel: kindLabel(row.kind as OrgNodeKind),
      lineageId: row.lineageId,
      displayName: row.displayName,
      changeType: row.changeType,
      changeTypeLabel: changeTypeLabel(row.changeType as OrgChangeType),
      summary: row.summary,
      beforePayload: row.beforePayload,
      afterPayload: row.afterPayload,
      changedBy: row.changedBy,
      createdAt: row.createdAt,
    }));
  }

  async getLog(logId: number): Promise<IrOrgChangeLog> {
    const log = await this.logRepo.findOne({ where: { logId } });
    if (!log) throw new NotFoundException('변경이력을 찾을 수 없습니다.');
    return log;
  }

  async listYearFacts(year: number) {
    return this.logRepo.find({
      where: { year },
      order: { logId: 'ASC' },
    });
  }

  async listLoggedYears(): Promise<number[]> {
    const rows = await this.logRepo
      .createQueryBuilder('log')
      .select('DISTINCT log.year', 'year')
      .orderBy('log.year', 'ASC')
      .getRawMany<{ year: string | number }>();
    return rows
      .map((row) => Number(row.year))
      .filter((year) => Number.isInteger(year));
  }
}
