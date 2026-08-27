import { aggregateDeptMaps } from './aggregate';
import type { KpiViewModel } from './fetchMonitoringData';
import type { OrgStructure, YearValueMap } from './types';

export type CompareKind = 'series' | 'dept';
export type CompareSortKey = 'value' | 'name' | 'order';
export type CompareSortDir = 'asc' | 'desc';

export interface CompareBarRow {
  id: string;
  name: string;
  kind: CompareKind;
  value: number | null;
  seriesOrder: number;
  deptOrder: number;
  /** 구성 항목별 값. 2개 이상이면 누적 차트에 사용 */
  parts?: Record<string, number | null>;
}

function stackOf(view: KpiViewModel): {
  keys: string[];
  labels: Record<string, string>;
  depts: Record<string, Record<string, YearValueMap>>;
} | null {
  if (view.stackBreakdown) return view.stackBreakdown;
  if (!view.studentBreakdown) return null;
  return {
    keys: [...view.studentBreakdown.keys],
    labels: { ...view.studentBreakdown.labels },
    depts: { ...view.studentBreakdown.depts },
  };
}

function partValue(
  view: KpiViewModel,
  key: string,
  deptCode: string,
  year: number,
): number | null {
  return stackOf(view)?.depts[key]?.[deptCode]?.[year] ?? null;
}

function seriesPartValue(
  view: KpiViewModel,
  key: string,
  deptCodes: string[],
  year: number,
  method: KpiViewModel['kpi']['seriesAggregation'],
): number | null {
  const maps = deptCodes.map(
    (code) => stackOf(view)?.depts[key]?.[code] ?? {},
  );
  return aggregateDeptMaps(maps, [year], method)[year] ?? null;
}

function rowParts(
  view: KpiViewModel,
  year: number,
  deptCodes: string[],
  kind: CompareKind,
  deptCode?: string,
): CompareBarRow['parts'] | undefined {
  const keys = stackOf(view)?.keys;
  if (!keys?.length) return undefined;
  const method = view.kpi.seriesAggregation;
  const parts: NonNullable<CompareBarRow['parts']> = {};
  for (const key of keys) {
    parts[key] =
      kind === 'series'
        ? seriesPartValue(view, key, deptCodes, year, method)
        : partValue(view, key, deptCode ?? '', year);
  }
  return parts;
}

export function buildCompareRows(
  view: KpiViewModel,
  org: OrgStructure,
  opts: { showSeries: boolean; showDepts: boolean },
): CompareBarRow[] {
  const year = view.selectedYear ?? view.years[view.years.length - 1];
  if (year == null) return [];

  const method = view.kpi.seriesAggregation;
  const rows: CompareBarRow[] = [];

  for (const series of org.series) {
    const deptCodes = series.departments.map((d) => d.deptCode);
    if (opts.showSeries) {
      const deptMaps = series.departments.map(
        (d) => view.depts[d.deptCode] ?? {},
      );
      const aggregated = aggregateDeptMaps(deptMaps, [year], method);
      rows.push({
        id: `series:${series.id}`,
        name: series.name,
        kind: 'series',
        value: aggregated[year] ?? null,
        seriesOrder: series.displayOrder,
        deptOrder: -1,
        parts: rowParts(view, year, deptCodes, 'series'),
      });
    }
    if (opts.showDepts) {
      for (const dept of series.departments) {
        rows.push({
          id: `dept:${dept.deptCode}`,
          name: dept.deptName,
          kind: 'dept',
          value: view.depts[dept.deptCode]?.[year] ?? null,
          seriesOrder: series.displayOrder,
          deptOrder: dept.displayOrder,
          parts: rowParts(view, year, deptCodes, 'dept', dept.deptCode),
        });
      }
    }
  }

  return rows;
}

export function sortCompareRows(
  rows: CompareBarRow[],
  key: CompareSortKey,
  dir: CompareSortDir,
): CompareBarRow[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'value') {
      if (a.value == null && b.value == null) return orderFallback(a, b) * mul;
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      const diff = a.value - b.value;
      return diff !== 0 ? diff * mul : orderFallback(a, b);
    }
    if (key === 'name') {
      const diff = a.name.localeCompare(b.name, 'ko');
      return diff !== 0 ? diff * mul : orderFallback(a, b);
    }
    return orderFallback(a, b) * mul;
  });
}

/** 편제 트리 나열순: 계열 순 → 해당 계열 행 → 소속 학과 순 */
function orderFallback(a: CompareBarRow, b: CompareBarRow): number {
  if (a.seriesOrder !== b.seriesOrder) return a.seriesOrder - b.seriesOrder;
  const ak = a.kind === 'series' ? -1 : a.deptOrder;
  const bk = b.kind === 'series' ? -1 : b.deptOrder;
  return ak - bk;
}
