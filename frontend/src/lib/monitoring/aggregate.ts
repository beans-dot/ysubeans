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

export const UNIV_ONLY_HIERARCHY_MESSAGE =
  '대학 전체값만 존재하는 지표입니다';

function valueAt(map: YearValueMap, year?: number): number | null {
  return year == null
    ? (Object.values(map).find((v): v is number => v != null) ?? null)
    : readYearValue(map, year);
}

/**
 * 피벗이 대학(_ALL_)만 있는 값을 학과 타깃에 복제한 연도인지.
 * 존재하는 학과값이 모두 대학값과 같으면 복제로 본다.
 * (일부 학과만 피벗 행이 없어도 동일)
 */
export function isUnivBroadcastYear(
  deptMaps: Record<string, YearValueMap>,
  year?: number,
  univ?: YearValueMap,
): boolean {
  const maps = Object.values(deptMaps);
  const present = maps
    .map((m) => valueAt(m, year))
    .filter((v): v is number => v != null);
  if (present.length === 0) return false;
  const univVal = univ ? valueAt(univ, year) : null;
  if (univVal != null) return present.every((v) => v === univVal);
  // 대학 행을 못 읽어도, 전 학과가 동일한 값이면 _ALL_ 복제로 본다.
  return (
    maps.length > 1 &&
    present.length === maps.length &&
    present.every((v) => v === present[0])
  );
}

/**
 * 계열·학과 비교에 쓸 실제 하위위계 데이터가 있는지.
 * 피벗은 대학(_ALL_)만 있는 지표 값을 학과 타깃에 복제하므로,
 * 그 복제값은 하위위계가 없는 것으로 본다.
 */
export function hasHierarchyData(
  deptMaps: Record<string, YearValueMap>,
  year?: number,
  univ?: YearValueMap,
): boolean {
  const maps = Object.values(deptMaps);
  if (maps.length === 0) return false;
  if (isUnivBroadcastYear(deptMaps, year, univ)) return false;
  return maps.some((m) => valueAt(m, year) != null);
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
