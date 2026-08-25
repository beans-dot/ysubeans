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
import {
  INTERNAL_DEPT_CODE_PREFIX,
  UNCATEGORIZED_SERIES_NAME,
} from './internal-org.constants';

export interface InternalDeptNode {
  deptPk: number;
  deptCode: string;
  deptName: string;
  displayOrder: number;
  rawCount: number;
}

export interface InternalSeriesNode {
  seriesId: number;
  seriesName: string;
  displayOrder: number;
  isUncategorized: boolean;
  departments: InternalDeptNode[];
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
  ) {}

  private isUncategorized(s: IrInternalSeries): boolean {
    return s.seriesName === UNCATEGORIZED_SERIES_NAME;
  }

  async ensureUncategorizedSeries(): Promise<IrInternalSeries> {
    let cat = await this.seriesRepo.findOne({
      where: {
        univCode: this.ysuCode,
        seriesName: UNCATEGORIZED_SERIES_NAME,
      },
    });
    if (!cat) {
      cat = await this.seriesRepo.save(
        this.seriesRepo.create({
          univCode: this.ysuCode,
          seriesName: UNCATEGORIZED_SERIES_NAME,
          displayOrder: -1,
        }),
      );
    } else if (cat.displayOrder !== -1) {
      await this.seriesRepo.update(cat.seriesId, { displayOrder: -1 });
      cat.displayOrder = -1;
    }
    return cat;
  }

  /**
   * 최초 1회: 공시 ir_department(연성대)를 자체 편제로 복사.
   * 학과 코드는 그대로 두어 이미 업로드된 자체 데이터와 연결을 유지한다.
   */
  async ensureSeeded(): Promise<void> {
    if (this.seeded) {
      await this.ensureUncategorizedSeries();
      return;
    }

    await this.ensureUncategorizedSeries();
    const existing = await this.deptRepo.count({
      where: { univCode: this.ysuCode },
    });
    if (existing > 0) {
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
          seriesName: seriesNames[i],
          displayOrder: i,
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
          }),
        );
      });

    if (toSave.length > 0) {
      await this.deptRepo.save(toSave);
    }
    this.seeded = true;
  }

  async getTree(): Promise<InternalSeriesNode[]> {
    await this.ensureSeeded();
    const series = await this.seriesRepo.find({
      where: { univCode: this.ysuCode },
      order: { displayOrder: 'ASC', seriesId: 'ASC' },
    });
    const depts = await this.deptRepo.find({
      where: { univCode: this.ysuCode },
      order: { displayOrder: 'ASC', deptPk: 'ASC' },
    });

    const codes = depts.map((d) => d.deptCode);
    const rawCounts = new Map<string, number>();
    if (codes.length > 0) {
      const rows: Array<{ deptCode: string; cnt: string }> =
        await this.rawRepo
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

    const nodes: InternalSeriesNode[] = series.map((s) => ({
      seriesId: s.seriesId,
      seriesName: s.seriesName,
      displayOrder: s.displayOrder,
      isUncategorized: this.isUncategorized(s),
      departments: depts
        .filter((d) => d.seriesId === s.seriesId)
        .map((d) => ({
          deptPk: d.deptPk,
          deptCode: d.deptCode,
          deptName: d.deptName,
          displayOrder: d.displayOrder,
          rawCount: rawCounts.get(d.deptCode) ?? 0,
        })),
    }));

    return nodes.sort((a, b) => {
      if (a.isUncategorized) return -1;
      if (b.isUncategorized) return 1;
      return a.displayOrder - b.displayOrder || a.seriesId - b.seriesId;
    });
  }

  /** 회원가입·회원정보 소속(학과) 드롭다운용. 계열 순서를 유지한다. */
  async listAffiliationMajors(): Promise<
    Array<{ deptName: string; seriesName: string }>
  > {
    await this.ensureSeeded();
    const series = await this.seriesRepo.find({
      where: { univCode: this.ysuCode },
      order: { displayOrder: 'ASC', seriesId: 'ASC' },
    });
    const depts = await this.deptRepo.find({
      where: { univCode: this.ysuCode },
      order: { displayOrder: 'ASC', deptPk: 'ASC' },
    });
    const orderedSeries = [...series].sort((a, b) => {
      if (this.isUncategorized(a) && !this.isUncategorized(b)) return -1;
      if (!this.isUncategorized(a) && this.isUncategorized(b)) return 1;
      return a.displayOrder - b.displayOrder || a.seriesId - b.seriesId;
    });
    return orderedSeries.flatMap((s) =>
      depts
        .filter((d) => d.seriesId === s.seriesId && d.deptName.trim())
        .map((d) => ({
          deptName: d.deptName,
          seriesName: s.seriesName,
        })),
    );
  }

  async listYeonsungDeptsForCodebook(): Promise<
    Array<{ deptCode: string; deptName: string; seriesLg: string | null }>
  > {
    const tree = await this.getTree();
    return tree.flatMap((s) =>
      s.departments.map((d) => ({
        deptCode: d.deptCode,
        deptName: d.deptName,
        seriesLg: s.isUncategorized ? null : s.seriesName,
      })),
    );
  }

  async getDeptNameMap(univCode: string): Promise<Map<string, string>> {
    if (univCode !== this.ysuCode) return new Map();
    await this.ensureSeeded();
    const depts = await this.deptRepo.find({ where: { univCode } });
    return new Map(
      depts.map((d) => [`${d.univCode}::${d.deptCode}`, d.deptName]),
    );
  }

  async createSeries(seriesName: string): Promise<IrInternalSeries> {
    await this.ensureSeeded();
    const name = seriesName.trim();
    if (!name) {
      throw new BadRequestException('계열 이름을 입력해 주세요.');
    }
    if (name === UNCATEGORIZED_SERIES_NAME) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_SERIES_NAME}」은 시스템 계열입니다.`,
      );
    }
    const dup = await this.seriesRepo.findOne({
      where: { univCode: this.ysuCode, seriesName: name },
    });
    if (dup) {
      throw new BadRequestException('같은 이름의 계열이 이미 있습니다.');
    }
    const max = await this.seriesRepo
      .createQueryBuilder('s')
      .select('MAX(s.displayOrder)', 'max')
      .where('s.univCode = :univ', { univ: this.ysuCode })
      .getRawOne<{ max: number | null }>();
    return this.seriesRepo.save(
      this.seriesRepo.create({
        univCode: this.ysuCode,
        seriesName: name,
        displayOrder: (max?.max ?? 0) + 1,
      }),
    );
  }

  async updateSeries(
    seriesId: number,
    seriesName: string,
  ): Promise<IrInternalSeries> {
    const cat = await this.seriesRepo.findOne({ where: { seriesId } });
    if (!cat || cat.univCode !== this.ysuCode) {
      throw new NotFoundException('계열을 찾을 수 없습니다.');
    }
    if (this.isUncategorized(cat)) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_SERIES_NAME}」이름은 변경할 수 없습니다.`,
      );
    }
    const name = seriesName.trim();
    if (!name) {
      throw new BadRequestException('계열 이름을 입력해 주세요.');
    }
    if (name === UNCATEGORIZED_SERIES_NAME) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_SERIES_NAME}」은 시스템 계열입니다.`,
      );
    }
    const dup = await this.seriesRepo.findOne({
      where: { univCode: this.ysuCode, seriesName: name },
    });
    if (dup && dup.seriesId !== seriesId) {
      throw new BadRequestException('같은 이름의 계열이 이미 있습니다.');
    }
    cat.seriesName = name;
    return this.seriesRepo.save(cat);
  }

  async deleteSeries(seriesId: number): Promise<{ ok: true; moved: number }> {
    const cat = await this.seriesRepo.findOne({ where: { seriesId } });
    if (!cat || cat.univCode !== this.ysuCode) {
      throw new NotFoundException('계열을 찾을 수 없습니다.');
    }
    if (this.isUncategorized(cat)) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_SERIES_NAME}」계열은 삭제할 수 없습니다.`,
      );
    }
    const uncat = await this.ensureUncategorizedSeries();
    const moved = await this.deptRepo.count({ where: { seriesId } });
    await this.deptRepo.update({ seriesId }, { seriesId: uncat.seriesId });
    await this.seriesRepo.delete(seriesId);
    return { ok: true, moved };
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
  ): Promise<IrInternalDepartment> {
    await this.ensureSeeded();
    const series = await this.seriesRepo.findOne({ where: { seriesId } });
    if (!series || series.univCode !== this.ysuCode) {
      throw new NotFoundException('계열을 찾을 수 없습니다.');
    }
    const name = deptName.trim();
    if (!name) {
      throw new BadRequestException('학과명을 입력해 주세요.');
    }
    const max = await this.deptRepo
      .createQueryBuilder('d')
      .select('MAX(d.displayOrder)', 'max')
      .where('d.seriesId = :id', { id: seriesId })
      .getRawOne<{ max: number | null }>();
    const deptCode = await this.nextDeptCode();
    return this.deptRepo.save(
      this.deptRepo.create({
        univCode: this.ysuCode,
        deptCode,
        deptName: name,
        seriesId,
        displayOrder: (max?.max ?? -1) + 1,
      }),
    );
  }

  async updateDepartment(
    deptPk: number,
    data: { deptName?: string; seriesId?: number },
  ): Promise<IrInternalDepartment> {
    const dept = await this.deptRepo.findOne({ where: { deptPk } });
    if (!dept || dept.univCode !== this.ysuCode) {
      throw new NotFoundException('학과를 찾을 수 없습니다.');
    }
    if (data.deptName !== undefined) {
      const name = data.deptName.trim();
      if (!name) {
        throw new BadRequestException('학과명을 입력해 주세요.');
      }
      dept.deptName = name;
    }
    if (data.seriesId !== undefined && data.seriesId !== dept.seriesId) {
      const series = await this.seriesRepo.findOne({
        where: { seriesId: data.seriesId },
      });
      if (!series || series.univCode !== this.ysuCode) {
        throw new NotFoundException('계열을 찾을 수 없습니다.');
      }
      dept.seriesId = data.seriesId;
    }
    return this.deptRepo.save(dept);
  }

  async deleteDepartment(
    deptPk: number,
  ): Promise<{ ok: true; deptCode: string; rawCount: number }> {
    const dept = await this.deptRepo.findOne({ where: { deptPk } });
    if (!dept || dept.univCode !== this.ysuCode) {
      throw new NotFoundException('학과를 찾을 수 없습니다.');
    }
    const rawCount = await this.rawRepo.count({
      where: { univCode: this.ysuCode, deptCode: dept.deptCode },
    });
    await this.deptRepo.delete(deptPk);
    return { ok: true, deptCode: dept.deptCode, rawCount };
  }

  async reorder(payload: {
    series?: { seriesId: number; displayOrder: number }[];
    departments?: {
      deptPk: number;
      seriesId: number;
      displayOrder: number;
    }[];
  }): Promise<{ ok: true }> {
    for (const s of payload.series ?? []) {
      await this.seriesRepo.update(s.seriesId, {
        displayOrder: s.displayOrder,
      });
    }
    for (const d of payload.departments ?? []) {
      await this.deptRepo.update(d.deptPk, {
        seriesId: d.seriesId,
        displayOrder: d.displayOrder,
      });
    }
    await this.ensureUncategorizedSeries();
    return { ok: true };
  }
}
