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

/**
 * 계열·학과 비교에 쓸 실제 하위위계 데이터가 있는지.
 * 피벗은 대학(_ALL_)만 있는 지표 값을 모든 학과 타깃에 복제하므로,
 * 선택 연도의 전 학과 값이 대학값과 같으면 하위위계가 없는 것으로 본다.
 */
export function hasHierarchyData(
  deptMaps: Record<string, YearValueMap>,
  year?: number,
  univ?: YearValueMap,
): boolean {
  const maps = Object.values(deptMaps);
  if (maps.length === 0) return false;

  const at = (map: YearValueMap): number | null =>
    year == null
      ? (Object.values(map).find((v): v is number => v != null) ?? null)
      : readYearValue(map, year);

  const deptVals = maps.map(at);
  const present = deptVals.filter((v): v is number => v != null);
  if (present.length === 0) return false;

  const univVal = univ ? at(univ) : null;
  if (
    univVal != null &&
    present.length === deptVals.length &&
    present.every((v) => v === univVal)
  ) {
    return false;
  }
  return true;
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
