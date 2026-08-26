import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IrDepartment,
  IrInternalDepartment,
  IrInternalSeries,
  IrRawData,
} from '../../entities';
import {
  isPlaceholderDepartment,
  normalizeSeriesLg,
} from '../universities/yeonsung.data';
import { OrgAnnualSyncService } from './org-annual-sync.service';
import {
  INTERNAL_DEPT_CODE_PREFIX,
  ORG_MIN_YEAR,
  SERIES_CODE_PREFIX,
  UNCATEGORIZED_SERIES_CODE,
  UNCATEGORIZED_SERIES_NAME,
  activeAt,
  defaultOrgYear,
} from './org.constants';
import { OrgVersioningService } from './org-versioning.service';

export interface InternalDeptNode {
  deptPk: number;
  deptCode: string;
  deptName: string;
  displayOrder: number;
  rawCount: number;
  effectiveFrom: number;
  abolishedFrom: number | null;
}

export interface InternalSeriesNode {
  seriesId: number;
  seriesCode: string | null;
  seriesName: string;
  displayOrder: number;
  isUncategorized: boolean;
  departments: InternalDeptNode[];
  effectiveFrom: number;
  abolishedFrom: number | null;
}

export interface ResolvedDept {
  deptPk: number;
  deptCode: string;
  deptName: string;
  seriesId: number;
  displayOrder: number;
  effectiveFrom: number;
  abolishedFrom: number | null;
}

export interface ResolvedSeries {
  seriesId: number;
  seriesCode: string | null;
  seriesName: string;
  displayOrder: number;
  isUncategorized: boolean;
  effectiveFrom: number;
  abolishedFrom: number | null;
}

@Injectable()
export class InternalOrgService {
  private readonly ysuCode = process.env.YSU_UNIV_CODE || '0002651';
  private seeded = false;

  constructor(
    @InjectRepository(IrInternalSeries)
    private readonly seriesRepo: Repository<IrInternalSeries>,
    @InjectRepository(IrInternalDepartment)
    private readonly deptRepo: Repository<IrInternalDepartment>,
    @InjectRepository(IrDepartment)
    private readonly publicDeptRepo: Repository<IrDepartment>,
    @InjectRepository(IrRawData)
    private readonly rawRepo: Repository<IrRawData>,
    private readonly versioning: OrgVersioningService,
    private readonly annualSync: OrgAnnualSyncService,
  ) {}

  private isUncategorized(s: {
    seriesName: string;
    seriesCode?: string | null;
  }): boolean {
    return (
      s.seriesName === UNCATEGORIZED_SERIES_NAME ||
      s.seriesCode === UNCATEGORIZED_SERIES_CODE
    );
  }

  private seriesPayload(s: IrInternalSeries) {
    return {
      name: s.seriesName,
      seriesCode: s.seriesCode,
      displayOrder: s.displayOrder,
      effectiveFrom: s.effectiveFrom,
      abolishedFrom: s.abolishedFrom,
    };
  }

  private deptPayload(d: IrInternalDepartment) {
    return {
      name: d.deptName,
      deptCode: d.deptCode,
      seriesId: d.seriesId,
      displayOrder: d.displayOrder,
      effectiveFrom: d.effectiveFrom,
      abolishedFrom: d.abolishedFrom,
    };
  }

  async ensureUncategorizedSeries(): Promise<IrInternalSeries> {
    let cat = await this.seriesRepo.findOne({
      where: {
        univCode: this.ysuCode,
        seriesName: UNCATEGORIZED_SERIES_NAME,
      },
    });
    if (!cat) {
      cat = await this.seriesRepo.findOne({
        where: { univCode: this.ysuCode, seriesCode: UNCATEGORIZED_SERIES_CODE },
      });
    }
    if (!cat) {
      cat = await this.seriesRepo.save(
        this.seriesRepo.create({
          univCode: this.ysuCode,
          seriesCode: UNCATEGORIZED_SERIES_CODE,
          seriesName: UNCATEGORIZED_SERIES_NAME,
          displayOrder: -1,
          effectiveFrom: ORG_MIN_YEAR,
          abolishedFrom: null,
        }),
      );
    } else {
      if (cat.displayOrder !== -1) cat.displayOrder = -1;
      if (!cat.seriesCode) cat.seriesCode = UNCATEGORIZED_SERIES_CODE;
      if (!cat.effectiveFrom) cat.effectiveFrom = ORG_MIN_YEAR;
      await this.seriesRepo.save(cat);
    }
    return cat;
  }

  private async nextSeriesCode(): Promise<string> {
    const rows = await this.seriesRepo.find({
      where: { univCode: this.ysuCode },
    });
    const used = new Set(rows.map((s) => s.seriesCode).filter(Boolean));
    let n = 1;
    let code = `${SERIES_CODE_PREFIX}${String(n).padStart(4, '0')}`;
    while (used.has(code)) {
      n += 1;
      code = `${SERIES_CODE_PREFIX}${String(n).padStart(4, '0')}`;
    }
    return code;
  }

  async ensureSeeded(): Promise<void> {
    if (this.seeded) {
      await this.ensureUncategorizedSeries();
      await this.ensureSeriesCodes();
      return;
    }

    await this.ensureUncategorizedSeries();
    const existing = await this.deptRepo.count({
      where: { univCode: this.ysuCode },
    });
    if (existing > 0) {
      await this.ensureSeriesCodes();
      this.seeded = true;
      return;
    }

    const publicDepts = await this.publicDeptRepo.find({
      where: { univCode: this.ysuCode, isActive: true },
    });

    const bySeries = new Map<string, IrDepartment[]>();
    const uncategorized: IrDepartment[] = [];
    for (const d of publicDepts) {
      if (isPlaceholderDepartment(d.deptName)) continue;
      const series = normalizeSeriesLg(d.seriesLg);
      if (!series) {
        uncategorized.push(d);
        continue;
      }
      if (!bySeries.has(series)) bySeries.set(series, []);
      bySeries.get(series)!.push(d);
    }

    const seriesNames = Array.from(bySeries.keys()).sort((a, b) =>
      a.localeCompare(b, 'ko'),
    );
    const seriesIdByName = new Map<string, number>();
    for (let i = 0; i < seriesNames.length; i++) {
      const saved = await this.seriesRepo.save(
        this.seriesRepo.create({
          univCode: this.ysuCode,
          seriesCode: await this.nextSeriesCode(),
          seriesName: seriesNames[i],
          displayOrder: i,
          effectiveFrom: ORG_MIN_YEAR,
          abolishedFrom: null,
        }),
      );
      seriesIdByName.set(seriesNames[i], saved.seriesId);
    }

    const uncat = await this.ensureUncategorizedSeries();
    const toSave: IrInternalDepartment[] = [];

    for (const [name, list] of bySeries.entries()) {
      const seriesId = seriesIdByName.get(name)!;
      const sorted = [...list].sort((a, b) =>
        a.deptName.localeCompare(b.deptName, 'ko'),
      );
      sorted.forEach((d, index) => {
        toSave.push(
          this.deptRepo.create({
            univCode: this.ysuCode,
            deptCode: d.deptCode,
            deptName: d.deptName,
            seriesId,
            displayOrder: index,
            effectiveFrom: ORG_MIN_YEAR,
            abolishedFrom: null,
          }),
        );
      });
    }

    uncategorized
      .sort((a, b) => a.deptName.localeCompare(b.deptName, 'ko'))
      .forEach((d, index) => {
        toSave.push(
          this.deptRepo.create({
            univCode: this.ysuCode,
            deptCode: d.deptCode,
            deptName: d.deptName,
            seriesId: uncat.seriesId,
            displayOrder: index,
            effectiveFrom: ORG_MIN_YEAR,
            abolishedFrom: null,
          }),
        );
      });

    if (toSave.length > 0) {
      await this.deptRepo.save(toSave);
    }
    await this.ensureSeriesCodes();
    this.seeded = true;
  }

  private async ensureSeriesCodes(): Promise<void> {
    const rows = await this.seriesRepo.find({
      where: { univCode: this.ysuCode },
    });
    for (const s of rows) {
      let dirty = false;
      if (!s.seriesCode) {
        s.seriesCode = this.isUncategorized(s)
          ? UNCATEGORIZED_SERIES_CODE
          : await this.nextSeriesCode();
        dirty = true;
      }
      if (!s.effectiveFrom) {
        s.effectiveFrom = ORG_MIN_YEAR;
        dirty = true;
      }
      if (dirty) await this.seriesRepo.save(s);
    }
    const depts = await this.deptRepo.find({
      where: { univCode: this.ysuCode },
    });
    for (const d of depts) {
      if (!d.effectiveFrom) {
        d.effectiveFrom = ORG_MIN_YEAR;
        await this.deptRepo.save(d);
      }
    }
  }

  async resolveAt(year: number): Promise<{
    series: ResolvedSeries[];
    depts: ResolvedDept[];
  }> {
    await this.ensureSeeded();
    this.versioning.assertYear(year);
    const [seriesRows, deptRows, seriesMap, deptMap] = await Promise.all([
      this.seriesRepo.find({
        where: { univCode: this.ysuCode },
        order: { displayOrder: 'ASC', seriesId: 'ASC' },
      }),
      this.deptRepo.find({
        where: { univCode: this.ysuCode },
        order: { displayOrder: 'ASC', deptPk: 'ASC' },
      }),
      this.versioning.overlayMap('series', year),
      this.versioning.overlayMap('department', year),
    ]);

    const series: ResolvedSeries[] = [];
    for (const s of seriesRows) {
      if (!activeAt(s.effectiveFrom, s.abolishedFrom, year)) continue;
      const payload = seriesMap.get(String(s.seriesId));
      const seriesName = String(payload?.name ?? s.seriesName);
      series.push({
        seriesId: s.seriesId,
        seriesCode: String(payload?.seriesCode ?? s.seriesCode ?? ''),
        seriesName,
        displayOrder: Number(payload?.displayOrder ?? s.displayOrder),
        isUncategorized: this.isUncategorized({
          seriesName,
          seriesCode: String(payload?.seriesCode ?? s.seriesCode ?? ''),
        }),
        effectiveFrom: s.effectiveFrom,
        abolishedFrom: s.abolishedFrom,
      });
    }

    const depts: ResolvedDept[] = [];
    for (const d of deptRows) {
      if (!activeAt(d.effectiveFrom, d.abolishedFrom, year)) continue;
      const payload = deptMap.get(String(d.deptPk));
      depts.push({
        deptPk: d.deptPk,
        deptCode: d.deptCode,
        deptName: String(payload?.name ?? d.deptName),
        seriesId: Number(payload?.seriesId ?? d.seriesId),
        displayOrder: Number(payload?.displayOrder ?? d.displayOrder),
        effectiveFrom: d.effectiveFrom,
        abolishedFrom: d.abolishedFrom,
      });
    }

    series.sort((a, b) => {
      if (a.isUncategorized) return -1;
      if (b.isUncategorized) return 1;
      return a.displayOrder - b.displayOrder || a.seriesId - b.seriesId;
    });
    return { series, depts };
  }

  async getTree(year?: number): Promise<InternalSeriesNode[]> {
    const asOf = year ?? defaultOrgYear();
    const { series, depts } = await this.resolveAt(asOf);
    const codes = depts.map((d) => d.deptCode);
    const rawCounts = new Map<string, number>();
    if (codes.length > 0) {
      const rows: Array<{ deptCode: string; cnt: string }> = await this.rawRepo
        .createQueryBuilder('r')
        .select('r.deptCode', 'deptCode')
        .addSelect('COUNT(*)', 'cnt')
        .where('r.univCode = :univ', { univ: this.ysuCode })
        .andWhere('r.deptCode IN (:...codes)', { codes })
        .groupBy('r.deptCode')
        .getRawMany();
      for (const row of rows) {
        rawCounts.set(row.deptCode, Number(row.cnt) || 0);
      }
    }

    return series.map((s) => ({
      seriesId: s.seriesId,
      seriesCode: s.seriesCode,
      seriesName: s.seriesName,
      displayOrder: s.displayOrder,
      isUncategorized: s.isUncategorized,
      effectiveFrom: s.effectiveFrom,
      abolishedFrom: s.abolishedFrom,
      departments: depts
        .filter((d) => d.seriesId === s.seriesId)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.deptPk - b.deptPk)
        .map((d) => ({
          deptPk: d.deptPk,
          deptCode: d.deptCode,
          deptName: d.deptName,
          displayOrder: d.displayOrder,
          rawCount: rawCounts.get(d.deptCode) ?? 0,
          effectiveFrom: d.effectiveFrom,
          abolishedFrom: d.abolishedFrom,
        })),
    }));
  }

  async memberDeptCodesForSeries(seriesId: number, year: number): Promise<string[]> {
    const { depts } = await this.resolveAt(year);
    return depts.filter((d) => d.seriesId === seriesId).map((d) => d.deptCode);
  }

  async memberDeptCodesForUniv(year: number): Promise<string[]> {
    const { depts } = await this.resolveAt(year);
    return depts.map((d) => d.deptCode);
  }

  async unionDeptsForYears(years: number[]): Promise<
    Array<{ deptCode: string; deptName: string; seriesId: number }>
  > {
    if (years.length === 0) return [];
    const latest = Math.max(...years);
    const latestResolved = await this.resolveAt(latest);
    const byCode = new Map<
      string,
      { deptCode: string; deptName: string; seriesId: number }
    >();
    for (const d of latestResolved.depts) {
      byCode.set(d.deptCode, {
        deptCode: d.deptCode,
        deptName: d.deptName,
        seriesId: d.seriesId,
      });
    }
    for (const year of years) {
      if (year === latest) continue;
      const { depts } = await this.resolveAt(year);
      for (const d of depts) {
        if (!byCode.has(d.deptCode)) {
          byCode.set(d.deptCode, {
            deptCode: d.deptCode,
            deptName: d.deptName,
            seriesId: d.seriesId,
          });
        }
      }
    }
    return [...byCode.values()];
  }

  async listAffiliationMajors(): Promise<
    Array<{ deptCode: string; deptName: string; seriesName: string }>
  > {
    const { series, depts } = await this.resolveAt(defaultOrgYear());
    return series.flatMap((s) =>
      depts
        .filter((d) => d.seriesId === s.seriesId && d.deptName.trim())
        .map((d) => ({
          deptCode: d.deptCode,
          deptName: d.deptName,
          seriesName: s.seriesName,
        })),
    );
  }

  async listYeonsungDeptsForCodebook(year?: number): Promise<
    Array<{ deptCode: string; deptName: string; seriesLg: string | null }>
  > {
    const tree = await this.getTree(year ?? defaultOrgYear());
    return tree.flatMap((s) =>
      s.departments.map((d) => ({
        deptCode: d.deptCode,
        deptName: d.deptName,
        seriesLg: s.isUncategorized ? null : s.seriesName,
      })),
    );
  }

  async getDeptNameMap(
    univCode: string,
    year?: number,
  ): Promise<Map<string, string>> {
    if (univCode !== this.ysuCode) return new Map();
    const asOf = year ?? defaultOrgYear();
    const { depts } = await this.resolveAt(asOf);
    return new Map(
      depts.map((d) => [`${univCode}::${d.deptCode}`, d.deptName]),
    );
  }

  async createSeries(
    seriesName: string,
    year: number,
    userId?: string,
  ): Promise<IrInternalSeries> {
    await this.ensureSeeded();
    this.versioning.assertYear(year);
    const name = seriesName.trim();
    if (!name) throw new BadRequestException('계열 이름을 입력해 주세요.');
    if (name === UNCATEGORIZED_SERIES_NAME) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_SERIES_NAME}」은 시스템 계열입니다.`,
      );
    }
    const { series } = await this.resolveAt(year);
    if (series.some((s) => s.seriesName === name)) {
      throw new BadRequestException('같은 이름의 계열이 이미 있습니다.');
    }
    const max = Math.max(0, ...series.map((s) => s.displayOrder));
    const saved = await this.seriesRepo.save(
      this.seriesRepo.create({
        univCode: this.ysuCode,
        seriesCode: await this.nextSeriesCode(),
        seriesName: name,
        displayOrder: max + 1,
        effectiveFrom: year,
        abolishedFrom: null,
      }),
    );
    const payload = this.seriesPayload(saved);
    await this.versioning.writeVersion({
      kind: 'series',
      lineageId: String(saved.seriesId),
      alphaCode: saved.seriesCode ?? '',
      displayName: name,
      year,
      changeType: 'create',
      payload,
      userId,
    });
    await this.versioning.recordChange({
      year,
      kind: 'series',
      lineageId: String(saved.seriesId),
      displayName: name,
      changeType: 'create',
      summary: `${name} 신설`,
      before: null,
      after: payload,
      userId,
    });
    await this.annualSync.sync(year);
    return saved;
  }

  async updateSeries(
    seriesId: number,
    seriesName: string,
    year: number,
    userId?: string,
  ): Promise<IrInternalSeries> {
    this.versioning.assertYear(year);
    const cat = await this.seriesRepo.findOne({ where: { seriesId } });
    if (!cat || cat.univCode !== this.ysuCode) {
      throw new NotFoundException('계열을 찾을 수 없습니다.');
    }
    if (this.isUncategorized(cat)) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_SERIES_NAME}」이름은 변경할 수 없습니다.`,
      );
    }
    if (!activeAt(cat.effectiveFrom, cat.abolishedFrom, year)) {
      throw new BadRequestException('해당 학년도에 존재하지 않는 계열입니다.');
    }
    const name = seriesName.trim();
    if (!name) throw new BadRequestException('계열 이름을 입력해 주세요.');
    if (name === UNCATEGORIZED_SERIES_NAME) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_SERIES_NAME}」은 시스템 계열입니다.`,
      );
    }
    const { series } = await this.resolveAt(year);
    if (series.some((s) => s.seriesName === name && s.seriesId !== seriesId)) {
      throw new BadRequestException('같은 이름의 계열이 이미 있습니다.');
    }
    const overlay = await this.versioning.overlayPayload(
      'series',
      String(seriesId),
      year,
    );
    const before = overlay ?? this.seriesPayload(cat);
    const renamed = name !== String(before.name ?? cat.seriesName);
    cat.seriesName = name;
    await this.seriesRepo.save(cat);
    const after = this.seriesPayload(cat);
    await this.versioning.writeVersion({
      kind: 'series',
      lineageId: String(cat.seriesId),
      alphaCode: cat.seriesCode ?? '',
      displayName: name,
      year,
      changeType: 'update',
      payload: after,
      previousPayload: before,
      userId,
    });
    await this.versioning.recordChange({
      year,
      kind: 'series',
      lineageId: String(cat.seriesId),
      displayName: name,
      changeType: 'update',
      summary: renamed
        ? `${String(before.name)} → ${name}`
        : `${name} 수정`,
      before,
      after,
      userId,
    });
    if (renamed) {
      await this.annualSync.sync(year);
    }
    return cat;
  }

  async abolishSeries(
    seriesId: number,
    year: number,
    userId?: string,
  ): Promise<{ ok: true; moved: number }> {
    this.versioning.assertYear(year);
    const cat = await this.seriesRepo.findOne({ where: { seriesId } });
    if (!cat || cat.univCode !== this.ysuCode) {
      throw new NotFoundException('계열을 찾을 수 없습니다.');
    }
    if (this.isUncategorized(cat)) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_SERIES_NAME}」계열은 폐지할 수 없습니다.`,
      );
    }
    if (!activeAt(cat.effectiveFrom, cat.abolishedFrom, year)) {
      throw new BadRequestException('해당 학년도에 존재하지 않는 계열입니다.');
    }
    const uncat = await this.ensureUncategorizedSeries();
    const { depts } = await this.resolveAt(year);
    const children = depts.filter((d) => d.seriesId === seriesId);
    for (const child of children) {
      await this.updateDepartment(
        child.deptPk,
        { seriesId: uncat.seriesId },
        year,
        userId,
      );
    }
    const overlay = await this.versioning.overlayPayload(
      'series',
      String(seriesId),
      year,
    );
    const before = overlay ?? this.seriesPayload(cat);
    cat.abolishedFrom = year;
    await this.seriesRepo.save(cat);
    const after = this.seriesPayload(cat);
    await this.versioning.writeVersion({
      kind: 'series',
      lineageId: String(cat.seriesId),
      alphaCode: cat.seriesCode ?? '',
      displayName: cat.seriesName,
      year,
      changeType: 'abolish',
      payload: after,
      previousPayload: before,
      userId,
    });
    await this.versioning.recordChange({
      year,
      kind: 'series',
      lineageId: String(cat.seriesId),
      displayName: cat.seriesName,
      changeType: 'abolish',
      summary: `${cat.seriesName} 폐지`,
      before,
      after,
      userId,
    });
    await this.annualSync.sync(year);
    return { ok: true, moved: children.length };
  }

  private async nextDeptCode(): Promise<string> {
    const rows = await this.deptRepo.find({
      where: { univCode: this.ysuCode },
    });
    const used = new Set(rows.map((d) => d.deptCode));
    let max = 0;
    for (const d of rows) {
      const m = new RegExp(
        `^${INTERNAL_DEPT_CODE_PREFIX}(\\d+)$`,
        'i',
      ).exec(d.deptCode);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    let n = max + 1;
    let code = `${INTERNAL_DEPT_CODE_PREFIX}${String(n).padStart(4, '0')}`;
    while (used.has(code)) {
      n += 1;
      code = `${INTERNAL_DEPT_CODE_PREFIX}${String(n).padStart(4, '0')}`;
    }
    return code;
  }

  async createDepartment(
    seriesId: number,
    deptName: string,
    year: number,
    userId?: string,
  ): Promise<IrInternalDepartment> {
    await this.ensureSeeded();
    this.versioning.assertYear(year);
    const series = await this.seriesRepo.findOne({ where: { seriesId } });
    if (!series || series.univCode !== this.ysuCode) {
      throw new NotFoundException('계열을 찾을 수 없습니다.');
    }
    if (!activeAt(series.effectiveFrom, series.abolishedFrom, year)) {
      throw new BadRequestException('해당 학년도에 존재하지 않는 계열입니다.');
    }
    const name = deptName.trim();
    if (!name) throw new BadRequestException('학과명을 입력해 주세요.');
    const { depts } = await this.resolveAt(year);
    const max = Math.max(
      -1,
      ...depts.filter((d) => d.seriesId === seriesId).map((d) => d.displayOrder),
    );
    const saved = await this.deptRepo.save(
      this.deptRepo.create({
        univCode: this.ysuCode,
        deptCode: await this.nextDeptCode(),
        deptName: name,
        seriesId,
        displayOrder: max + 1,
        effectiveFrom: year,
        abolishedFrom: null,
      }),
    );
    const payload = this.deptPayload(saved);
    await this.versioning.writeVersion({
      kind: 'department',
      lineageId: String(saved.deptPk),
      alphaCode: saved.deptCode,
      displayName: name,
      year,
      changeType: 'create',
      payload,
      userId,
    });
    await this.versioning.recordChange({
      year,
      kind: 'department',
      lineageId: String(saved.deptPk),
      displayName: name,
      changeType: 'create',
      summary: `${name} 신설`,
      before: null,
      after: payload,
      userId,
    });
    await this.annualSync.sync(year);
    return saved;
  }

  async updateDepartment(
    deptPk: number,
    data: { deptName?: string; seriesId?: number; displayOrder?: number },
    year: number,
    userId?: string,
  ): Promise<IrInternalDepartment> {
    this.versioning.assertYear(year);
    const dept = await this.deptRepo.findOne({ where: { deptPk } });
    if (!dept || dept.univCode !== this.ysuCode) {
      throw new NotFoundException('학과를 찾을 수 없습니다.');
    }
    if (!activeAt(dept.effectiveFrom, dept.abolishedFrom, year)) {
      throw new BadRequestException('해당 학년도에 존재하지 않는 학과입니다.');
    }
    const overlay = await this.versioning.overlayPayload(
      'department',
      String(deptPk),
      year,
    );
    const before = overlay ?? this.deptPayload(dept);
    if (data.deptName !== undefined) {
      const name = data.deptName.trim();
      if (!name) throw new BadRequestException('학과명을 입력해 주세요.');
      dept.deptName = name;
    }
    if (data.seriesId !== undefined && data.seriesId !== dept.seriesId) {
      const series = await this.seriesRepo.findOne({
        where: { seriesId: data.seriesId },
      });
      if (!series || series.univCode !== this.ysuCode) {
        throw new NotFoundException('계열을 찾을 수 없습니다.');
      }
      if (!activeAt(series.effectiveFrom, series.abolishedFrom, year)) {
        throw new BadRequestException('해당 학년도에 존재하지 않는 계열입니다.');
      }
      dept.seriesId = data.seriesId;
    }
    if (data.displayOrder !== undefined) {
      dept.displayOrder = data.displayOrder;
    }
    await this.deptRepo.save(dept);
    const after = this.deptPayload(dept);
    const renamed =
      String(before.name ?? '') !== String(after.name ?? '');
    await this.versioning.writeVersion({
      kind: 'department',
      lineageId: String(dept.deptPk),
      alphaCode: dept.deptCode,
      displayName: dept.deptName,
      year,
      changeType: 'update',
      payload: after,
      previousPayload: before,
      userId,
    });
    await this.versioning.recordChange({
      year,
      kind: 'department',
      lineageId: String(dept.deptPk),
      displayName: dept.deptName,
      changeType: 'update',
      summary: renamed
        ? `${String(before.name)} → ${dept.deptName}`
        : `${dept.deptName} 수정`,
      before,
      after,
      userId,
    });
    if (renamed) {
      await this.annualSync.sync(year);
    }
    return dept;
  }

  async abolishDepartment(
    deptPk: number,
    year: number,
    userId?: string,
  ): Promise<{ ok: true; deptCode: string; rawCount: number }> {
    this.versioning.assertYear(year);
    const dept = await this.deptRepo.findOne({ where: { deptPk } });
    if (!dept || dept.univCode !== this.ysuCode) {
      throw new NotFoundException('학과를 찾을 수 없습니다.');
    }
    if (!activeAt(dept.effectiveFrom, dept.abolishedFrom, year)) {
      throw new BadRequestException('해당 학년도에 존재하지 않는 학과입니다.');
    }
    const overlay = await this.versioning.overlayPayload(
      'department',
      String(deptPk),
      year,
    );
    const before = overlay ?? this.deptPayload(dept);
    dept.abolishedFrom = year;
    await this.deptRepo.save(dept);
    const after = this.deptPayload(dept);
    await this.versioning.writeVersion({
      kind: 'department',
      lineageId: String(dept.deptPk),
      alphaCode: dept.deptCode,
      displayName: dept.deptName,
      year,
      changeType: 'abolish',
      payload: after,
      previousPayload: before,
      userId,
    });
    await this.versioning.recordChange({
      year,
      kind: 'department',
      lineageId: String(dept.deptPk),
      displayName: dept.deptName,
      changeType: 'abolish',
      summary: `${dept.deptName} 폐지`,
      before,
      after,
      userId,
    });
    await this.annualSync.sync(year);
    const rawCount = await this.rawRepo.count({
      where: { univCode: this.ysuCode, deptCode: dept.deptCode },
    });
    return { ok: true, deptCode: dept.deptCode, rawCount };
  }

  async reorder(
    payload: {
      series?: { seriesId: number; displayOrder: number }[];
      departments?: {
        deptPk: number;
        seriesId: number;
        displayOrder: number;
      }[];
    },
    year: number,
    userId?: string,
  ): Promise<{ ok: true }> {
    this.versioning.assertYear(year);
    for (const s of payload.series ?? []) {
      const row = await this.seriesRepo.findOne({
        where: { seriesId: s.seriesId },
      });
      if (!row || this.isUncategorized(row)) continue;
      if (!activeAt(row.effectiveFrom, row.abolishedFrom, year)) continue;
      if (row.displayOrder === s.displayOrder) continue;
      const overlay = await this.versioning.overlayPayload(
        'series',
        String(row.seriesId),
        year,
      );
      const before = overlay ?? this.seriesPayload(row);
      row.displayOrder = s.displayOrder;
      await this.seriesRepo.save(row);
      const after = this.seriesPayload(row);
      await this.versioning.writeVersion({
        kind: 'series',
        lineageId: String(row.seriesId),
        alphaCode: row.seriesCode ?? '',
        displayName: row.seriesName,
        year,
        changeType: 'update',
        payload: after,
        previousPayload: before,
        userId,
      });
    }
    for (const d of payload.departments ?? []) {
      const row = await this.deptRepo.findOne({ where: { deptPk: d.deptPk } });
      if (!row) continue;
      if (!activeAt(row.effectiveFrom, row.abolishedFrom, year)) continue;
      if (row.seriesId === d.seriesId && row.displayOrder === d.displayOrder) {
        continue;
      }
      await this.updateDepartment(
        d.deptPk,
        { seriesId: d.seriesId, displayOrder: d.displayOrder },
        year,
        userId,
      );
    }
    await this.ensureUncategorizedSeries();
    return { ok: true };
  }

  async rollback(logId: number, userId: string) {
    const log = await this.versioning.getLog(logId);
    if (!log.beforePayload) {
      throw new BadRequestException('되돌릴 이전 내용이 없습니다.');
    }
    const payload = log.beforePayload;
    const year = log.year;
    if (log.kind === 'series') {
      const row = await this.seriesRepo.findOne({
        where: { seriesId: Number(log.lineageId) },
      });
      if (!row) throw new NotFoundException('계열을 찾을 수 없습니다.');
      const before = this.seriesPayload(row);
      row.seriesName = String(payload.name ?? row.seriesName);
      row.displayOrder = Number(payload.displayOrder ?? row.displayOrder);
      row.abolishedFrom =
        payload.abolishedFrom === undefined
          ? row.abolishedFrom
          : (payload.abolishedFrom as number | null);
      await this.seriesRepo.save(row);
      const after = this.seriesPayload(row);
      await this.versioning.writeVersion({
        kind: 'series',
        lineageId: String(row.seriesId),
        alphaCode: row.seriesCode ?? '',
        displayName: row.seriesName,
        year,
        changeType: 'rollback',
        payload: after,
        userId,
      });
      await this.versioning.recordChange({
        year,
        kind: 'series',
        lineageId: String(row.seriesId),
        displayName: row.seriesName,
        changeType: 'rollback',
        summary: `${row.seriesName} 롤백`,
        before,
        after,
        userId,
      });
      await this.annualSync.sync(year);
      return after;
    }
    if (log.kind === 'department') {
      const row = await this.deptRepo.findOne({
        where: { deptPk: Number(log.lineageId) },
      });
      if (!row) throw new NotFoundException('학과를 찾을 수 없습니다.');
      const before = this.deptPayload(row);
      row.deptName = String(payload.name ?? row.deptName);
      row.seriesId = Number(payload.seriesId ?? row.seriesId);
      row.displayOrder = Number(payload.displayOrder ?? row.displayOrder);
      row.abolishedFrom =
        payload.abolishedFrom === undefined
          ? row.abolishedFrom
          : (payload.abolishedFrom as number | null);
      await this.deptRepo.save(row);
      const after = this.deptPayload(row);
      await this.versioning.writeVersion({
        kind: 'department',
        lineageId: String(row.deptPk),
        alphaCode: row.deptCode,
        displayName: row.deptName,
        year,
        changeType: 'rollback',
        payload: after,
        userId,
      });
      await this.versioning.recordChange({
        year,
        kind: 'department',
        lineageId: String(row.deptPk),
        displayName: row.deptName,
        changeType: 'rollback',
        summary: `${row.deptName} 롤백`,
        before,
        after,
        userId,
      });
      await this.annualSync.sync(year);
      return after;
    }
    throw new BadRequestException('이 이력은 계열·학과 화면에서 되돌리세요.');
  }
}
