import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrDepartment, IrUniversityMaster } from '../../entities';
import { InternalOrgService } from '../internal-org/internal-org.service';
import {
  isPlaceholderDepartment,
  normalizeSeriesLg,
} from './yeonsung.data';

export interface TargetTreeNode {
  id: string;
  label: string;
  level: string;
  univCode?: string;
  deptCode?: string;
  isYeonsung?: boolean;
  selectable: boolean;
  /** 대학 전체 = 전 학과 평균일 때 (competitiveness) */
  memberDeptCodes?: string[];
  /** 다년 조회 상대비교용: 조회 구간에 한 번이라도 있던 학과 */
  periodDepts?: Array<{ deptCode: string; deptName: string }>;
  children?: TargetTreeNode[];
}

const SCHOOL_TYPE_ORDER = ['전문대학', '4년제'];
const REGION_TYPE_ORDER = ['수도권', '비수도권'];

@Injectable()
export class UniversitiesService {
  private readonly ysuCode = process.env.YSU_UNIV_CODE || '0002651';

  constructor(
    @InjectRepository(IrUniversityMaster)
    private readonly univRepo: Repository<IrUniversityMaster>,
    @InjectRepository(IrDepartment)
    private readonly deptRepo: Repository<IrDepartment>,
    private readonly internalOrg: InternalOrgService,
  ) {}

  async list(): Promise<IrUniversityMaster[]> {
    return this.univRepo.find({ order: { univName: 'ASC' } });
  }

  /** 공시 학과(ir_department)를 대계열 → 학과 트리로 그룹핑 */
  private buildSeriesChildren(
    univCode: string,
    list: IrDepartment[],
    opts: { isYeonsung: boolean; idPrefix: string },
  ): TargetTreeNode[] {
    const bySeries = new Map<string, IrDepartment[]>();
    list.forEach((d) => {
      if (isPlaceholderDepartment(d.deptName)) return;
      // 대계열 미기재·'기타'는 묶지 않음. 동기화 누락분만 제외.
      const s = normalizeSeriesLg(d.seriesLg);
      if (!s) return;
      if (!bySeries.has(s)) bySeries.set(s, []);
      bySeries.get(s)!.push(d);
    });

    return Array.from(bySeries.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'ko'))
      .map(([series, ds]) => ({
        id: `${opts.idPrefix}:series:${univCode}:${series}`,
        label: series,
        level: 'series',
        univCode,
        isYeonsung: opts.isYeonsung,
        selectable: true,
        children: ds
          .slice()
          .sort((a, b) => a.deptName.localeCompare(b.deptName, 'ko'))
          .map((d) => ({
            id: `${opts.idPrefix}:dept:${univCode}:${d.deptCode}`,
            label: d.deptName,
            level: 'dept',
            univCode,
            deptCode: d.deptCode,
            isYeonsung: opts.isYeonsung,
            selectable: true,
          })),
      }));
  }

  // 2-1 연성대학교 (공시): 대학 단위만 — 계열·학과는 자체경쟁력 트리에서 제공
  private async buildYeonsungTree(): Promise<TargetTreeNode> {
    const univ = await this.univRepo.findOne({
      where: { univCode: this.ysuCode },
    });

    return {
      id: 'root:yeonsung',
      label: univ?.univName || '연성대학교',
      level: 'root',
      univCode: this.ysuCode,
      isYeonsung: true,
      selectable: true,
    };
  }

  // 2-2 타 대학 4단계: 학교종류 -> 권역 -> 지역 -> 대학명
  // (공시 API는 대학 단위 비교만 가능하므로 계열·학과는 노출하지 않음)
  private async buildOthersTree(): Promise<TargetTreeNode> {
    const univs = (await this.univRepo.find()).filter(
      (u) => u.univCode !== this.ysuCode,
    );

    const buildUnivNode = (u: IrUniversityMaster): TargetTreeNode => ({
      id: `oth:univ:${u.univCode}`,
      label: u.univName,
      level: 'univ',
      univCode: u.univCode,
      isYeonsung: false,
      selectable: true,
    });

    // 학교종류 -> 권역 -> 지역 -> 대학
    const tree = new Map<
      string,
      Map<string, Map<string, IrUniversityMaster[]>>
    >();
    for (const u of univs) {
      const st = u.schoolType?.trim();
      const rt = u.regionType?.trim() || '비수도권';
      const rc = u.regionCity?.trim();
      // 학교종류·지역이 없거나 '기타'면 임의 버킷에 넣지 않고 제외
      if (!st || st === '기타' || !rc || rc === '기타') continue;
      if (!tree.has(st)) tree.set(st, new Map());
      const regionTypeMap = tree.get(st)!;
      if (!regionTypeMap.has(rt)) regionTypeMap.set(rt, new Map());
      const cityMap = regionTypeMap.get(rt)!;
      if (!cityMap.has(rc)) cityMap.set(rc, []);
      cityMap.get(rc)!.push(u);
    }

    const sortKeys = (keys: string[], order: string[]) =>
      keys.sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b, 'ko');
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

    return {
      id: 'root:others',
      label: '타 대학',
      level: 'root',
      isYeonsung: false,
      selectable: false,
      children: sortKeys(Array.from(tree.keys()), SCHOOL_TYPE_ORDER).map(
        (st) => ({
          id: `oth:st:${st}`,
          label: st,
          level: 'schoolType',
          selectable: false,
          children: sortKeys(
            Array.from(tree.get(st)!.keys()),
            REGION_TYPE_ORDER,
          ).map((rt) => ({
            id: `oth:rt:${st}:${rt}`,
            label: rt,
            level: 'region',
            selectable: false,
            children: Array.from(tree.get(st)!.get(rt)!.keys())
              .sort((a, b) => a.localeCompare(b, 'ko'))
              .map((rc) => ({
                id: `oth:rc:${st}:${rt}:${rc}`,
                label: rc,
                level: 'regionCity',
                selectable: false,
                children: tree
                  .get(st)!
                  .get(rt)!
                  .get(rc)!
                  .sort((a, b) => a.univName.localeCompare(b.univName, 'ko'))
                  .map(buildUnivNode),
              })),
          })),
        }),
      ),
    };
  }

  async getTargetTree(
    scope?: 'internal',
    year?: number,
    years?: number[],
  ): Promise<TargetTreeNode[]> {
    if (scope === 'internal') {
      return this.buildCompetitivenessTree(year, years);
    }
    const [yeonsung, others] = await Promise.all([
      this.buildYeonsungTree(),
      this.buildOthersTree(),
    ]);
    return [yeonsung, others];
  }

  /**
   * 자체 경쟁력: 타대학 없이
   * [대학 전체] 연성대학교(전 학과 평균) / [계열/학과별] 계열-학과 트리
   */
  private async buildCompetitivenessTree(
    year?: number,
    years?: number[],
  ): Promise<TargetTreeNode[]> {
    const univ = await this.univRepo.findOne({
      where: { univCode: this.ysuCode },
    });
    const asOf = year ?? (years && years.length ? Math.max(...years) : undefined);
    const org = await this.internalOrg.getTree(asOf);
    const union =
      years && years.length > 1
        ? await this.internalOrg.unionDeptsForYears(years)
        : [];
    const unionBySeries = new Map<number, Array<{ deptCode: string; deptName: string }>>();
    for (const d of union) {
      const list = unionBySeries.get(d.seriesId) ?? [];
      list.push({ deptCode: d.deptCode, deptName: d.deptName });
      unionBySeries.set(d.seriesId, list);
    }
    const seriesChildren: TargetTreeNode[] = org
      .filter((s) => s.departments.length > 0)
      .map((s) => ({
        id: `ys:series:${this.ysuCode}:${s.seriesId}`,
        label: s.seriesName,
        level: 'series',
        univCode: this.ysuCode,
        isYeonsung: true,
        selectable: true,
        periodDepts: unionBySeries.get(s.seriesId),
        children: s.departments.map((d) => ({
          id: `ys:dept:${this.ysuCode}:${d.deptCode}`,
          label: d.deptName,
          level: 'dept',
          univCode: this.ysuCode,
          deptCode: d.deptCode,
          isYeonsung: true,
          selectable: true,
        })),
      }));
    const memberDeptCodes = seriesChildren.flatMap(
      (s) => s.children?.map((d) => d.deptCode).filter((c): c is string => !!c) ?? [],
    );
    const periodDepts = union.length
      ? union.map((d) => ({ deptCode: d.deptCode, deptName: d.deptName }))
      : undefined;

    return [
      {
        id: 'section:univ',
        label: '대학 전체',
        level: 'section',
        isYeonsung: true,
        selectable: false,
        children: [
          {
            id: 'root:yeonsung',
            label: univ?.univName || '연성대학교',
            level: 'root',
            univCode: this.ysuCode,
            isYeonsung: true,
            selectable: true,
            memberDeptCodes,
            periodDepts,
          },
        ],
      },
      {
        id: 'section:series',
        label: '계열/학과별',
        level: 'section',
        univCode: this.ysuCode,
        isYeonsung: true,
        selectable: false,
        children: seriesChildren.length > 0 ? seriesChildren : undefined,
      },
    ];
  }

  /**
   * 업로드 양식/코드북용. ir_university_master·ir_department 스냅샷을 그대로 반환
   * (대학알리미 배치 후 is_active 갱신이 자동 반영됨).
   */
  async getCodebook(year?: number): Promise<{
    generatedAt: string;
    referenceYear: number;
    yeonsung: {
      univCode: string;
      univName: string;
      departments: Array<{
        deptCode: string;
        deptName: string;
        seriesLg: string | null;
      }>;
    };
    universities: Array<{
      univCode: string;
      univName: string;
      schoolType: string | null;
      regionType: string | null;
      regionCity: string | null;
    }>;
    departments: Array<{
      univCode: string;
      univName: string;
      deptCode: string;
      deptName: string;
      seriesLg: string | null;
    }>;
  }> {
    const referenceYear = year ?? new Date().getFullYear();
    const [univs, depts] = await Promise.all([
      this.univRepo.find({ order: { univName: 'ASC' } }),
      this.deptRepo.find({
        where: { isActive: true },
        order: { univCode: 'ASC', seriesLg: 'ASC', deptName: 'ASC' },
      }),
    ]);

    const univNameByCode = new Map(univs.map((u) => [u.univCode, u.univName]));
    const ysu = univs.find((u) => u.univCode === this.ysuCode);
    let ysuDepts = depts
      .filter((d) => d.univCode === this.ysuCode)
      .map((d) => ({
        deptCode: d.deptCode,
        deptName: d.deptName,
        seriesLg: d.seriesLg,
      }));
    try {
      const internal = await this.internalOrg.listYeonsungDeptsForCodebook(
        referenceYear,
      );
      if (internal.length > 0) {
        ysuDepts = internal;
      }
    } catch {
      // 자체 편제가 아직 없으면 공시 학과로 폴백
    }

    const internalByCode = new Map(ysuDepts.map((d) => [d.deptCode, d]));
    const departments = depts.map((d) => {
      const overlay =
        d.univCode === this.ysuCode ? internalByCode.get(d.deptCode) : undefined;
      return {
        univCode: d.univCode,
        univName: univNameByCode.get(d.univCode) || d.univCode,
        deptCode: d.deptCode,
        deptName: overlay?.deptName ?? d.deptName,
        seriesLg: overlay ? overlay.seriesLg : d.seriesLg,
      };
    });
    const extraInternal = ysuDepts.filter(
      (d) => !depts.some((p) => p.univCode === this.ysuCode && p.deptCode === d.deptCode),
    );
    for (const d of extraInternal) {
      departments.push({
        univCode: this.ysuCode,
        univName: ysu?.univName || '연성대학교',
        deptCode: d.deptCode,
        deptName: d.deptName,
        seriesLg: d.seriesLg,
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      referenceYear,
      yeonsung: {
        univCode: this.ysuCode,
        univName: ysu?.univName || '연성대학교',
        departments: ysuDepts,
      },
      universities: univs.map((u) => ({
        univCode: u.univCode,
        univName: u.univName,
        schoolType: u.schoolType,
        regionType: u.regionType,
        regionCity: u.regionCity,
      })),
      departments,
    };
  }
}
