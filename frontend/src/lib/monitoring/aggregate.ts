import type { SeriesAggregation, YearValueMap } from './types';
import { emptyYearMap } from './composeStudentCount';

export function aggregateDeptMaps(
  maps: YearValueMap[],
  years: number[],
  method: SeriesAggregation,
): YearValueMap {
  const out = emptyYearMap(years);
  for (const year of years) {
    const nums = maps
      .map((m) => m[year])
      .filter((v): v is number => v != null);
    if (nums.length === 0) out[year] = null;
    else if (method === 'sum') out[year] = nums.reduce((a, b) => a + b, 0);
    else out[year] = nums.reduce((a, b) => a + b, 0) / nums.length;
  }
  return out;
}

export function hasAnyValue(map: YearValueMap): boolean {
  return Object.values(map).some((v) => v != null);
}

export function hasHierarchyData(
  deptMaps: Record<string, YearValueMap>,
): boolean {
  return Object.values(deptMaps).some(hasAnyValue);
}

export function readYearValue(
  values: Record<number, number | null> | undefined,
  year: number,
): number | null {
  if (!values) return null;
  const direct = values[year];
  if (typeof direct === 'number') return direct;
  if (direct === null) return null;
  const asString = (values as Record<string, number | null>)[String(year)];
  return typeof asString === 'number' ? asString : null;
}
