import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  IrDepartment,
  IrInternalDepartment,
  IrMetricCategory,
  IrMetricRegistry,
  IrRawData,
  IrUpdateLog,
  type MetricSourceType,
  type UpdateLogDetail,
  type UpdateLogMetricDetail,
} from '../../entities';
import { UNCATEGORIZED_CATEGORY_NAME } from '../metrics/metric.constants';
import {
  metricNameLookupCandidates,
  syncDeptLevelMetricNames,
  withDeptLevelMetricSuffix,
} from '../metrics/metric-labels';

export interface UploadOptions {
  confirmOverwrite?: boolean;
  confirmLocked?: boolean;
  sourceType?: Extract<MetricSourceType, 'INTERNAL' | 'MONITORING'>;
}

/** 양식에서 인식하는 헤더. univ_name·dept_name 등 표시용 더미 열은 무시한다. */
const KNOWN_HEADERS = [
  'year',
  'univ_code',
  'dept_code',
  'metric_name',
  'metric_value',
  'metric_id',
] as const;

type KnownHeader = (typeof KNOWN_HEADERS)[number];

interface ParsedRowInput {
  rowNumber: number;
  year: number;
  univCode: string;
  deptCode: string;
  metricName: string;
  metricValue: string;
  metricIdHint?: number;
}

interface ParsedRow extends ParsedRowInput {
  metricId: number;
}

export type UploadResult =
  | {
      status: 'SUCCESS';
      inserted: number;
      updated: number;
      metricsCreated: number;
    }
  | {
      status: 'NEED_CONFIRM_OVERWRITE';
      message: string;
      conflictCount: number;
      samples: string[];
    }
  | {
      status: 'NEED_CONFIRM_LOCKED';
      message: string;
      lockedYears: number[];
    };

@Injectable()
export class UploadService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** ExcelJS 셀 값 → 문자열 (숫자·리치텍스트·수식 결과 대응) */
  private cellToString(rawCell: unknown): string {
    if (rawCell === undefined || rawCell === null) return '';
    if (typeof rawCell === 'string' || typeof rawCell === 'number') {
      return String(rawCell).trim();
    }
    if (typeof rawCell === 'boolean') return rawCell ? 'TRUE' : 'FALSE';
    if (typeof rawCell === 'object') {
      const o = rawCell as Record<string, unknown>;
      if ('result' in o && o.result !== undefined && o.result !== null) {
        return this.cellToString(o.result);
      }
      if (typeof o.text === 'string') return o.text.trim();
      if (Array.isArray(o.richText)) {
        return (o.richText as Array<{ text?: string }>)
          .map((t) => t.text ?? '')
          .join('')
          .trim();
      }
    }
    return String(rawCell).trim();
  }

  /**
   * 값 유효성: 빈칸/undefined는 즉시 Throw. 문자열 'NULL'과 숫자 0만 허용.
   */
  private validateValue(rawCell: unknown, rowNumber: number): string {
    const asString = this.cellToString(rawCell);
    if (asString === '') {
      throw new BadRequestException(
        `[${rowNumber}행] 결측치 발견: metric_value가 비어 있습니다. (허용: 'NULL' 또는 숫자)`,
      );
    }
    if (asString.toUpperCase() === 'NULL') return 'NULL';
    const num = Number(asString.replace(/,/g, ''));
    if (!Number.isFinite(num)) {
      throw new BadRequestException(
        `[${rowNumber}행] 유효하지 않은 값 '${asString}'. (허용: 'NULL' 또는 숫자)`,
      );
    }
    return asString;
  }

  private requireCell(
    rawCell: unknown,
    field: string,
    rowNumber: number,
  ): string {
    const value = this.cellToString(rawCell);
    if (value === '') {
      throw new BadRequestException(
        `[${rowNumber}행] 결측치 발견: '${field}' 값이 비어 있습니다.`,
      );
    }
    return value;
  }

  private async parseWorkbook(buffer: Buffer): Promise<ParsedRowInput[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('엑셀 시트를 찾을 수 없습니다.');
    }

    const headerRow = sheet.getRow(1);
    const headerIndex: Partial<Record<KnownHeader, number>> = {};
    headerRow.eachCell((cell, colNumber) => {
      const key = this.cellToString(cell.value).toLowerCase();
      // 양식 헤더만 인식. univ_name·dept_name·메모 등 기타 열은 무시.
      if ((KNOWN_HEADERS as readonly string[]).includes(key)) {
        headerIndex[key as KnownHeader] = colNumber;
      }
    });

    const required: KnownHeader[] = [
      'year',
      'univ_code',
      'metric_name',
      'metric_value',
    ];
    for (const col of required) {
      if (!headerIndex[col]) {
        throw new BadRequestException(
          `필수 헤더 누락: '${col}'. (필요 헤더: year, univ_code, dept_code, metric_name, metric_value)`,
        );
      }
    }

    const rows: ParsedRowInput[] = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      if (row.actualCellCount === 0) continue;

      const metricNameCell = row.getCell(headerIndex['metric_name']!).value;
      const metricValueCell = row.getCell(headerIndex['metric_value']!).value;
      const metricNameBlank = this.cellToString(metricNameCell) === '';
      const metricValueBlank = this.cellToString(metricValueCell) === '';
      // 샘플 양식의 빈 자리(코드만 채워진 행)는 스킵
      if (metricNameBlank && metricValueBlank) continue;

      const yearRaw = this.requireCell(
        row.getCell(headerIndex['year']!).value,
        'year',
        i,
      );
      const univCode = this.requireCell(
        row.getCell(headerIndex['univ_code']!).value,
        'univ_code',
        i,
      );
      const deptCode = headerIndex['dept_code']
        ? this.cellToString(row.getCell(headerIndex['dept_code']).value) ||
          '_ALL_'
        : '_ALL_';
      const metricName = this.requireCell(metricNameCell, 'metric_name', i);
      const metricValue = this.validateValue(metricValueCell, i);

      const year = parseInt(yearRaw, 10);
      if (!Number.isInteger(year)) {
        throw new BadRequestException(`[${i}행] year는 정수여야 합니다.`);
      }

      let metricIdHint: number | undefined;
      if (headerIndex['metric_id']) {
        const rawId = this.cellToString(
          row.getCell(headerIndex['metric_id']).value,
        );
        if (rawId) {
          const parsed = Number.parseInt(rawId, 10);
          if (!Number.isInteger(parsed)) {
            throw new BadRequestException(
              `[${i}행] metric_id는 정수여야 합니다.`,
            );
          }
          metricIdHint = parsed;
        }
      }

      rows.push({
        rowNumber: i,
        year,
        univCode,
        deptCode,
        metricName,
        metricValue,
        metricIdHint,
      });
    }

    if (rows.length === 0) {
      throw new BadRequestException('처리할 데이터 행이 없습니다.');
    }
    return rows;
  }

  private async ensureUncategorizedCategory(
    manager: EntityManager,
    sourceType: Extract<MetricSourceType, 'INTERNAL' | 'MONITORING'>,
  ): Promise<IrMetricCategory> {
    const catRepo = manager.getRepository(IrMetricCategory);
    let cat = await catRepo.findOne({
      where: {
        categoryName: UNCATEGORIZED_CATEGORY_NAME,
        sourceType,
      },
    });
    if (!cat) {
      cat = await catRepo.save(
        catRepo.create({
          categoryName: UNCATEGORIZED_CATEGORY_NAME,
          sourceType,
          displayOrder: -1,
        }),
      );
    } else if (cat.displayOrder !== -1) {
      await catRepo.update(cat.categoryId, { displayOrder: -1 });
      cat.displayOrder = -1;
    }
    return cat;
  }

  /**
   * metric_name → metric_id 해석.
   * INTERNAL 업로드는 공시·자체만 매칭하고, MONITORING 업로드는 모니터링 지표만 매칭한다.
   */
  private async resolveMetricIds(
    manager: EntityManager,
    inputs: ParsedRowInput[],
    uncategorizedId: number,
    sourceType: Extract<MetricSourceType, 'INTERNAL' | 'MONITORING'>,
  ): Promise<{
    rows: ParsedRow[];
    metricsCreated: number;
    createdMetricIds: number[];
  }> {
    const metricRepo = manager.getRepository(IrMetricRegistry);

    const uniqueNames = Array.from(
      new Set(
        inputs.filter((r) => r.metricIdHint == null).map((r) => r.metricName),
      ),
    );
    const deptLevelNames = new Set(
      inputs
        .filter((r) => r.deptCode !== '_ALL_')
        .map((r) => r.metricName),
    );

    const allCandidates = Array.from(
      new Set(uniqueNames.flatMap((n) => metricNameLookupCandidates(n))),
    );
    const existing =
      allCandidates.length > 0
        ? await metricRepo.find({
            where: { metricName: In(allCandidates) },
          })
        : [];

    const hintedIds = Array.from(
      new Set(
        inputs
          .map((r) => r.metricIdHint)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
    const hinted =
      hintedIds.length > 0
        ? await metricRepo.find({ where: { metricId: In(hintedIds) } })
        : [];
    const hintMap = new Map(hinted.map((m) => [m.metricId, m]));

    const findMatch = (inputName: string): IrMetricRegistry | undefined => {
      const candidates = metricNameLookupCandidates(inputName);
      const matches = existing.filter((m) =>
        candidates.includes(m.metricName),
      );
      if (matches.length === 0) return undefined;

      if (sourceType === 'MONITORING') {
        const monitoring = matches.filter((m) => m.sourceType === 'MONITORING');
        const exact = monitoring.filter((m) => m.metricName === inputName);
        const pool = exact.length > 0 ? exact : monitoring;
        if (pool.length > 1) {
          throw new BadRequestException(
            `지표명 '${inputName}'이(가) 대학주요모니터링에 여러 개 있습니다. metric_id 열로 지정해 주세요.`,
          );
        }
        return pool[0];
      }

      return (
        matches.find(
          (m) => m.metricName === inputName && m.sourceType === 'INTERNAL',
        ) ??
        matches.find(
          (m) => m.metricName === inputName && m.sourceType === 'ALIMI',
        ) ??
        matches.find((m) => m.sourceType === 'INTERNAL') ??
        matches.find((m) => m.sourceType === 'ALIMI')
      );
    };

    const nameToId = new Map<string, number>();
    let metricsCreated = 0;
    const createdMetricIds: number[] = [];

    for (const name of uniqueNames) {
      const found = findMatch(name);
      if (found) {
        nameToId.set(name, found.metricId);
        continue;
      }

      const isDeptLevel = deptLevelNames.has(name);
      const created = await metricRepo.save(
        metricRepo.create({
          categoryId: uncategorizedId,
          sourceType,
          metricName: isDeptLevel ? withDeptLevelMetricSuffix(name) : name,
          metricUnit: null,
          aggregationType: 'SUM',
          displayOrder: 0,
        }),
      );
      existing.push(created);
      nameToId.set(name, created.metricId);
      metricsCreated++;
      createdMetricIds.push(created.metricId);
    }

    const rows: ParsedRow[] = inputs.map((r) => {
      if (r.metricIdHint != null) {
        const hintedMetric = hintMap.get(r.metricIdHint);
        if (!hintedMetric) {
          throw new BadRequestException(
            `[${r.rowNumber}행] metric_id ${r.metricIdHint}를 찾을 수 없습니다.`,
          );
        }
        if (
          sourceType === 'MONITORING' &&
          hintedMetric.sourceType !== 'MONITORING'
        ) {
          throw new BadRequestException(
            `[${r.rowNumber}행] metric_id ${r.metricIdHint}는 모니터링 지표가 아닙니다.`,
          );
        }
        if (
          sourceType === 'INTERNAL' &&
          hintedMetric.sourceType === 'MONITORING'
        ) {
          throw new BadRequestException(
            `[${r.rowNumber}행] metric_id ${r.metricIdHint}는 모니터링 전용입니다. 모니터링 데이터 업로드를 이용하세요.`,
          );
        }
        return { ...r, metricId: hintedMetric.metricId };
      }
      return { ...r, metricId: nameToId.get(r.metricName)! };
    });

    return { rows, metricsCreated, createdMetricIds };
  }

  private deptKey(univCode: string, deptCode: string): string {
    return `${univCode}::${deptCode}`;
  }

  private async resolveDeptNameMap(
    manager: EntityManager,
    rows: ParsedRow[],
  ): Promise<Map<string, string>> {
    const pairs = Array.from(
      new Map(
        rows
          .filter((r) => r.deptCode && r.deptCode !== '_ALL_')
          .map((r) => [
            this.deptKey(r.univCode, r.deptCode),
            { univCode: r.univCode, deptCode: r.deptCode },
          ]),
      ).values(),
    );
    if (pairs.length === 0) return new Map();

    const univCodes = Array.from(new Set(pairs.map((p) => p.univCode)));
    const deptCodes = Array.from(new Set(pairs.map((p) => p.deptCode)));

    const [publicDepts, internalDepts] = await Promise.all([
      manager.getRepository(IrDepartment).find({
        where: { univCode: In(univCodes), deptCode: In(deptCodes) },
      }),
      manager.getRepository(IrInternalDepartment).find({
        where: { univCode: In(univCodes), deptCode: In(deptCodes) },
      }),
    ]);

    const map = new Map<string, string>();
    for (const d of publicDepts) {
      map.set(this.deptKey(d.univCode, d.deptCode), d.deptName);
    }
    for (const d of internalDepts) {
      map.set(this.deptKey(d.univCode, d.deptCode), d.deptName);
    }
    return map;
  }

  private async buildUploadDetail(
    manager: EntityManager,
    rows: ParsedRow[],
    createdMetricIds: Set<number>,
  ): Promise<UpdateLogDetail> {
    const metricIds = Array.from(new Set(rows.map((r) => r.metricId)));
    const metrics =
      metricIds.length > 0
        ? await manager.getRepository(IrMetricRegistry).find({
            where: { metricId: In(metricIds) },
          })
        : [];
    const nameById = new Map(metrics.map((m) => [m.metricId, m.metricName]));
    const deptNameMap = await this.resolveDeptNameMap(manager, rows);

    const deptsByMetric = new Map<number, Set<string>>();
    for (const r of rows) {
      if (!r.deptCode || r.deptCode === '_ALL_') continue;
      let set = deptsByMetric.get(r.metricId);
      if (!set) {
        set = new Set();
        deptsByMetric.set(r.metricId, set);
      }
      set.add(
        deptNameMap.get(this.deptKey(r.univCode, r.deptCode)) ?? r.deptCode,
      );
    }

    const details: UpdateLogMetricDetail[] = metricIds.map((id) => {
      const deptNames = Array.from(deptsByMetric.get(id) ?? []).sort((a, b) =>
        a.localeCompare(b, 'ko'),
      );
      return {
        metricName: nameById.get(id) ?? '(알 수 없음)',
        isNew: createdMetricIds.has(id),
        sampleDept: deptNames[0] ?? null,
        deptCount: deptNames.length,
      };
    });

    details.sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      return a.metricName.localeCompare(b.metricName, 'ko');
    });

    return { metrics: details };
  }

  /**
   * 3단계 검증 트랜잭션. 실패 시 전체 Rollback.
   */
  async processUpload(
    buffer: Buffer,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const inputs = await this.parseWorkbook(buffer);

    return this.dataSource
      .transaction(async (manager) => {
        const rawRepo = manager.getRepository(IrRawData);

        const sourceType =
          options.sourceType === 'MONITORING' ? 'MONITORING' : 'INTERNAL';
        const uncategorized = await this.ensureUncategorizedCategory(
          manager,
          sourceType,
        );
        const { rows, metricsCreated, createdMetricIds } =
          await this.resolveMetricIds(
            manager,
            inputs,
            uncategorized.categoryId,
            sourceType,
          );

        const existing = await rawRepo
          .createQueryBuilder('r')
          .where('r.year IN (:...years)', {
            years: Array.from(new Set(rows.map((r) => r.year))),
          })
          .getMany();

        const existKey = (
          year: number,
          univ: string,
          dept: string,
          metric: number,
        ) => `${year}|${univ}|${dept}|${metric}`;
        const existingMap = new Map<string, IrRawData>();
        existing.forEach((e) =>
          existingMap.set(
            existKey(e.year, e.univCode, e.deptCode, e.metricId),
            e,
          ),
        );

        const lockedYears = new Set<number>();
        for (const r of rows) {
          const found = existingMap.get(
            existKey(r.year, r.univCode, r.deptCode, r.metricId),
          );
          if (found?.isLocked) lockedYears.add(r.year);
        }
        if (lockedYears.size > 0 && !options.confirmLocked) {
          throw new UploadInterrupt({
            status: 'NEED_CONFIRM_LOCKED',
            message: `마감(잠금)된 연도 데이터가 포함되어 있습니다: ${Array.from(
              lockedYears,
            ).join(', ')}. 그래도 수정하시겠습니까?`,
            lockedYears: Array.from(lockedYears),
          });
        }

        const conflicts = rows.filter((r) =>
          existingMap.has(existKey(r.year, r.univCode, r.deptCode, r.metricId)),
        );
        if (conflicts.length > 0 && !options.confirmOverwrite) {
          throw new UploadInterrupt({
            status: 'NEED_CONFIRM_OVERWRITE',
            message: `이미 존재하는 데이터가 ${conflicts.length}건 있습니다. 덮어쓰시겠습니까?`,
            conflictCount: conflicts.length,
            samples: conflicts
              .slice(0, 5)
              .map(
                (c) =>
                  `${c.year} / ${c.univCode} / ${c.deptCode} / ${c.metricName}`,
              ),
          });
        }

        let inserted = 0;
        let updated = 0;
        for (const r of rows) {
          const key = existKey(r.year, r.univCode, r.deptCode, r.metricId);
          const isUpdate = existingMap.has(key);
          await manager
            .createQueryBuilder()
            .insert()
            .into(IrRawData)
            .values({
              year: r.year,
              univCode: r.univCode,
              deptCode: r.deptCode,
              metricId: r.metricId,
              metricValue: r.metricValue,
            })
            .orUpdate(
              ['metric_value'],
              ['year', 'univ_code', 'dept_code', 'metric_id'],
            )
            .execute();
          if (isUpdate) updated++;
          else inserted++;
        }

        // 학과단위(_ALL_ 아님) raw가 있는 지표 → 지표명에 (학과별) 보장
        await syncDeptLevelMetricNames(manager);

        const detail = await this.buildUploadDetail(
          manager,
          rows,
          new Set(createdMetricIds),
        );

        await manager.getRepository(IrUpdateLog).save({
          updateType: 'EXCEL_UPLOAD',
          logText: `자체 데이터 엑셀 업로드 (신규 ${inserted}건, 갱신 ${updated}건, 신규지표 ${metricsCreated}개)`,
          detail,
        });

        return {
          status: 'SUCCESS',
          inserted,
          updated,
          metricsCreated,
        } as UploadResult;
      })
      .catch((err) => {
        if (err instanceof UploadInterrupt) {
          return err.payload;
        }
        throw err;
      });
  }
}

class UploadInterrupt extends Error {
  constructor(public readonly payload: UploadResult) {
    super('UPLOAD_INTERRUPT');
  }
}
