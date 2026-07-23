import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  IrDepartment,
  IrMetricRegistry,
  IrRawData,
  IrUniversityMaster,
} from '../../entities';
import { UniversitiesService } from '../universities/universities.service';
import { PivotQueryDto, PivotResult, PivotRow, PivotTargetDto } from './pivot.dto';
import { collapsePivotTargets } from './target-collapse';

@Injectable()
export class PivotService {
  private readonly ysuCode = process.env.YSU_UNIV_CODE || '0002651';

  constructor(
    @InjectRepository(IrRawData)
    private readonly rawRepo: Repository<IrRawData>,
    @InjectRepository(IrMetricRegistry)
    private readonly metricRepo: Repository<IrMetricRegistry>,
    @InjectRepository(IrUniversityMaster)
    private readonly univRepo: Repository<IrUniversityMaster>,
    @InjectRepository(IrDepartment)
    private readonly deptRepo: Repository<IrDepartment>,
    private readonly universitiesService: UniversitiesService,
  ) {}

  private parseNumeric(value: string): number | null {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (trimmed === '' || trimmed.toUpperCase() === 'NULL') return null;
    const n = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  private aggregate(values: number[], type: string): number | null {
    if (values.length === 0) return null;
    switch ((type || 'SUM').toUpperCase()) {
      case 'AVG':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'MAX':
        return Math.max(...values);
      case 'MIN':
        return Math.min(...values);
      case 'SUM':
      default:
        return values.reduce((a, b) => a + b, 0);
    }
  }

  private targetKeyOf(univCode: string, deptCode?: string) {
    return deptCode ? `${univCode}::${deptCode}` : `${univCode}::_ALL_`;
  }

  private isUnivGroupTarget(t: PivotTargetDto): boolean {
    return (
      !!t.groupKey &&
      Array.isArray(t.memberUnivCodes) &&
      t.memberUnivCodes.length > 0
    );
  }

  private isDeptGroupTarget(t: PivotTargetDto): boolean {
    return (
      !!t.groupKey &&
      !!t.univCode &&
      Array.isArray(t.memberDeptCodes) &&
      t.memberDeptCodes.length > 0
    );
  }

  private isGroupTarget(t: PivotTargetDto): boolean {
    return this.isUnivGroupTarget(t) || this.isDeptGroupTarget(t);
  }

  async pivot(query: PivotQueryDto): Promise<PivotResult> {
    const { metricIds, years } = query;
    if (!query.targets?.length || !metricIds?.length || !years?.length) {
      return { years: years ?? [], rows: [] };
    }

    const tree = await this.universitiesService.getTargetTree();
    const targets = collapsePivotTargets(
      query.targets,
      tree,
      !!query.hierarchyIntegrate,
    );

    const individualTargets = targets.filter(
      (t) => !this.isGroupTarget(t) && !!t.univCode,
    );
    const univGroupTargets = targets.filter((t) => this.isUnivGroupTarget(t));
    const deptGroupTargets = targets.filter((t) => this.isDeptGroupTarget(t));

    const groupMemberUnivCodes = Array.from(
      new Set(univGroupTargets.flatMap((t) => t.memberUnivCodes ?? [])),
    );

    const univCodes = Array.from(
      new Set([
        ...individualTargets.map((t) => t.univCode as string),
        ...groupMemberUnivCodes,
        ...deptGroupTargets.map((t) => t.univCode as string),
      ]),
    );

    if (univCodes.length === 0) {
      return { years: [...years].sort((a, b) => a - b), rows: [] };
    }

    const metrics = await this.metricRepo.find({
      where: { metricId: In(metricIds) },
    });
    const metricMap = new Map(metrics.map((m) => [m.metricId, m]));

    const univs = await this.univRepo.find({
      where: { univCode: In(univCodes) },
    });
    const univMap = new Map(univs.map((u) => [u.univCode, u]));

    const neededDeptCodes = Array.from(
      new Set([
        ...individualTargets
          .map((t) => t.deptCode)
          .filter((c): c is string => !!c),
        ...deptGroupTargets.flatMap((g) => g.memberDeptCodes ?? []),
      ]),
    );
    const depts =
      neededDeptCodes.length > 0
        ? await this.deptRepo.find({
            where: {
              univCode: In(univCodes),
              deptCode: In(neededDeptCodes),
            },
          })
        : [];
    const deptNameMap = new Map(
      depts.map((d) => [`${d.univCode}::${d.deptCode}`, d.deptName]),
    );

    const rawRows = await this.rawRepo.find({
      where: {
        year: In(years),
        univCode: In(univCodes),
        metricId: In(metricIds),
      },
    });

    const buckets = new Map<string, number[]>();
    const pushBucket = (key: string, num: number) => {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(num);
    };

    const needUnivAll = new Set<string>([
      ...individualTargets
        .filter((t) => !t.deptCode)
        .map((t) => t.univCode as string),
      ...groupMemberUnivCodes,
    ]);

    const needDeptKeys = new Set<string>();
    for (const t of individualTargets) {
      if (t.deptCode) {
        needDeptKeys.add(this.targetKeyOf(t.univCode as string, t.deptCode));
      }
    }
    for (const g of deptGroupTargets) {
      needUnivAll.add(g.univCode as string);
      for (const dept of g.memberDeptCodes ?? []) {
        needDeptKeys.add(this.targetKeyOf(g.univCode as string, dept));
      }
    }

    // 대학 단위(_ALL_)가 없을 때 학과값 평균으로 대학값 산출하기 위한 버킷
    const univDeptFallback = new Map<string, number[]>();
    const pushUnivDeptFallback = (
      univCode: string,
      metricId: number,
      year: number,
      num: number,
    ) => {
      if (!needUnivAll.has(univCode)) return;
      const key = `${univCode}||${metricId}||${year}`;
      if (!univDeptFallback.has(key)) univDeptFallback.set(key, []);
      univDeptFallback.get(key)!.push(num);
    };

    // 지표별·대학별·연도별 학과단위 raw 존재 여부
    // → 학과 선택 시 _ALL_ 폴백은 '순수 대학단위 지표'에만 허용
    const hasDeptLevel = new Set<string>();
    for (const r of rawRows) {
      if (r.deptCode && r.deptCode !== '_ALL_') {
        hasDeptLevel.add(`${r.univCode}||${r.metricId}||${r.year}`);
      }
    }

    for (const r of rawRows) {
      const num = this.parseNumeric(r.metricValue);
      if (num === null) continue;

      if (r.deptCode && r.deptCode !== '_ALL_') {
        const deptKey = this.targetKeyOf(r.univCode, r.deptCode);
        if (needDeptKeys.has(deptKey)) {
          pushBucket(`${deptKey}||${r.metricId}||${r.year}`, num);
        }
        // 대학 단위 타깃: _ALL_ 부재 시 학과값 평균으로 대학값 산출
        pushUnivDeptFallback(r.univCode, r.metricId, r.year, num);
      }

      // 학과 타깃 + 순수 대학단위 지표(_ALL_만 존재)인 경우에만 _ALL_ 폴백
      if (r.deptCode === '_ALL_') {
        for (const t of individualTargets) {
          if (!t.deptCode || t.univCode !== r.univCode) continue;
          const deptLevelKey = `${r.univCode}||${r.metricId}||${r.year}`;
          if (hasDeptLevel.has(deptLevelKey)) continue;
          pushBucket(
            `${this.targetKeyOf(t.univCode as string, t.deptCode)}||${r.metricId}||${r.year}`,
            num,
          );
        }
      }

      if (r.deptCode === '_ALL_' && needUnivAll.has(r.univCode)) {
        pushBucket(
          `${this.targetKeyOf(r.univCode)}||${r.metricId}||${r.year}`,
          num,
        );
      }
    }

    const resolveUnivYearValue = (
      univCode: string,
      metricId: number,
      year: number,
      aggregationType: string,
    ): number | null => {
      const allBucket =
        buckets.get(`${this.targetKeyOf(univCode)}||${metricId}||${year}`) ?? [];
      const fromAll = this.aggregate(allBucket, aggregationType);
      if (fromAll !== null) return fromAll;
      const deptBucket =
        univDeptFallback.get(`${univCode}||${metricId}||${year}`) ?? [];
      return this.aggregate(deptBucket, aggregationType);
    };

    const rows: PivotRow[] = [];

    for (const t of individualTargets) {
      const tKey = this.targetKeyOf(t.univCode as string, t.deptCode);
      const univ = univMap.get(t.univCode as string);
      const isYeonsung = t.univCode === this.ysuCode;
      const deptCode = t.deptCode ?? null;

      for (const metricId of metricIds) {
        const metric = metricMap.get(metricId);
        if (!metric) continue;
        const values: Record<number, number | null> = {};
        let hasAny = false;
        for (const year of years) {
          const agg = deptCode
            ? this.aggregate(
                buckets.get(`${tKey}||${metricId}||${year}`) ?? [],
                metric.aggregationType,
              )
            : resolveUnivYearValue(
                t.univCode as string,
                metricId,
                year,
                metric.aggregationType,
              );
          values[year] = agg;
          if (agg !== null) hasAny = true;
        }
        if (!hasAny) continue;
        const deptName = deptCode
          ? deptNameMap.get(this.targetKeyOf(t.univCode as string, deptCode)) ??
            deptCode
          : null;
        const deptSuffix = deptName ? ` / ${deptName}` : '';
        rows.push({
          targetKey: tKey,
          targetLabel: `${univ?.univName ?? t.univCode}${deptSuffix}`,
          univCode: t.univCode as string,
          deptCode,
          isYeonsung,
          metricId,
          metricName: metric.metricName,
          metricUnit: metric.metricUnit,
          aggregationType: metric.aggregationType,
          values,
        });
      }
    }

    for (const g of univGroupTargets) {
      const members = Array.from(new Set(g.memberUnivCodes ?? []));
      const groupKey = g.groupKey as string;
      const groupLabel = g.groupLabel || groupKey;

      for (const metricId of metricIds) {
        const metric = metricMap.get(metricId);
        if (!metric) continue;
        const values: Record<number, number | null> = {};
        let hasAny = false;

        for (const year of years) {
          const univValues: number[] = [];
          for (const code of members) {
            const univAgg = resolveUnivYearValue(
              code,
              metricId,
              year,
              metric.aggregationType,
            );
            if (univAgg !== null) univValues.push(univAgg);
          }
          values[year] =
            univValues.length === 0
              ? null
              : univValues.reduce((a, b) => a + b, 0) / univValues.length;
          if (values[year] !== null) hasAny = true;
        }

        if (!hasAny) continue;
        rows.push({
          targetKey: groupKey,
          targetLabel: groupLabel,
          univCode: groupKey,
          deptCode: null,
          isYeonsung: false,
          metricId,
          metricName: metric.metricName,
          metricUnit: metric.metricUnit,
          aggregationType: 'AVG',
          values,
        });
      }
    }

    for (const g of deptGroupTargets) {
      const univCode = g.univCode as string;
      const members = Array.from(new Set(g.memberDeptCodes ?? []));
      const groupKey = g.groupKey as string;
      const groupLabel = g.groupLabel || groupKey;
      const isYeonsung = !!g.isYeonsung || univCode === this.ysuCode;

      for (const metricId of metricIds) {
        const metric = metricMap.get(metricId);
        if (!metric) continue;
        const values: Record<number, number | null> = {};
        let hasAny = false;

        for (const year of years) {
          const deptValues: number[] = [];
          for (const dept of members) {
            const bucket =
              buckets.get(
                `${this.targetKeyOf(univCode, dept)}||${metricId}||${year}`,
              ) ?? [];
            const deptAgg = this.aggregate(bucket, metric.aggregationType);
            if (deptAgg !== null) deptValues.push(deptAgg);
          }
          if (deptValues.length === 0) {
            // 순수 대학단위 지표(_ALL_만 존재)일 때만 폴백.
            // 학과단위 데이터가 있는 지표는 멤버 학과 raw 부재 시 null.
            const deptLevelKey = `${univCode}||${metricId}||${year}`;
            if (!hasDeptLevel.has(deptLevelKey)) {
              const univBucket =
                buckets.get(
                  `${this.targetKeyOf(univCode)}||${metricId}||${year}`,
                ) ?? [];
              values[year] = this.aggregate(
                univBucket,
                metric.aggregationType,
              );
            } else {
              values[year] = null;
            }
          } else {
            values[year] =
              deptValues.reduce((a, b) => a + b, 0) / deptValues.length;
          }
          if (values[year] !== null) hasAny = true;
        }

        if (!hasAny) continue;
        rows.push({
          targetKey: groupKey,
          targetLabel: groupLabel,
          univCode,
          deptCode: null,
          isYeonsung,
          metricId,
          metricName: metric.metricName,
          metricUnit: metric.metricUnit,
          aggregationType: 'AVG',
          values,
        });
      }
    }

    return { years: [...years].sort((a, b) => a - b), rows };
  }
}
