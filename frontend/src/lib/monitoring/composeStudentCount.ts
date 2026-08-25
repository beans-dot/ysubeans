import type {
  HierarchyValues,
  StudentCountComponentKey,
  StudentCountToggles,
  YearValueMap,
} from './types';

export function emptyYearMap(years: number[]): YearValueMap {
  return Object.fromEntries(years.map((y) => [y, null]));
}

export function selectedComponentKeys(
  toggles: StudentCountToggles,
): StudentCountComponentKey[] {
  const keys: StudentCountComponentKey[] = [];
  if (toggles.includeInner) keys.push('inner');
  if (toggles.includeOuter) keys.push('outer');
  if (toggles.includeLeave) keys.push('leave');
  if (toggles.includeDeferred) keys.push('deferred');
  return keys;
}

export function sumYearMaps(
  maps: YearValueMap[],
  years: number[],
): YearValueMap {
  const out = emptyYearMap(years);
  for (const year of years) {
    const parts = maps.map((m) => m[year] ?? null);
    if (parts.every((v) => v == null)) out[year] = null;
    else out[year] = parts.reduce<number>((s, v) => s + (v ?? 0), 0);
  }
  return out;
}

export function composeStudentCount(
  components: Record<StudentCountComponentKey, YearValueMap>,
  toggles: StudentCountToggles,
  years: number[],
): YearValueMap {
  const keys = selectedComponentKeys(toggles);
  return sumYearMaps(
    keys.map((k) => components[k] ?? emptyYearMap(years)),
    years,
  );
}

export function composeStudentCountHierarchy(
  components: Record<StudentCountComponentKey, HierarchyValues>,
  toggles: StudentCountToggles,
  years: number[],
  deptCodes: string[],
): HierarchyValues {
  const keys = selectedComponentKeys(toggles);
  const univ = sumYearMaps(
    keys.map((k) => components[k]?.univ ?? emptyYearMap(years)),
    years,
  );
  const depts: Record<string, YearValueMap> = {};
  for (const code of deptCodes) {
    depts[code] = sumYearMaps(
      keys.map((k) => components[k]?.depts[code] ?? emptyYearMap(years)),
      years,
    );
  }
  return {
    univ: fillMissingUnivFromDepts(univ, depts, years),
    depts,
  };
}

/** 대학 단위가 없으면 학과 합으로 총계를 맞춤 (추이·카드와 비교가 같은 도출값) */
function fillMissingUnivFromDepts(
  univ: YearValueMap,
  depts: Record<string, YearValueMap>,
  years: number[],
): YearValueMap {
  const out = { ...univ };
  const maps = Object.values(depts);
  for (const year of years) {
    if (out[year] != null) continue;
    const nums = maps
      .map((m) => m[year])
      .filter((v): v is number => v != null);
    out[year] = nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
  }
  return out;
}
