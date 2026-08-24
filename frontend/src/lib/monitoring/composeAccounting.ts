import type { HierarchyValues, YearValueMap } from './types';
import { emptyYearMap, sumYearMaps } from './composeStudentCount';

export function subtractYearMaps(
  left: YearValueMap,
  right: YearValueMap,
  years: number[],
): YearValueMap {
  const out = emptyYearMap(years);
  for (const year of years) {
    const a = left[year] ?? null;
    const b = right[year] ?? null;
    if (a == null && b == null) out[year] = null;
    else out[year] = (a ?? 0) - (b ?? 0);
  }
  return out;
}

export function composeAccountingNet(
  income: YearValueMap,
  expense: YearValueMap,
  years: number[],
): YearValueMap {
  return subtractYearMaps(income, expense, years);
}

export function composeAccountingHierarchy(
  incomeLines: HierarchyValues[],
  expenseLines: HierarchyValues[],
  years: number[],
  deptCodes: string[],
): {
  income: HierarchyValues;
  expense: HierarchyValues;
  net: HierarchyValues;
} {
  const empty = {
    univ: emptyYearMap(years),
    depts: Object.fromEntries(deptCodes.map((c) => [c, emptyYearMap(years)])),
  };
  const sumH = (parts: HierarchyValues[]): HierarchyValues => {
    if (parts.length === 0) return empty;
    const univ = sumYearMaps(
      parts.map((p) => p.univ),
      years,
    );
    const depts: Record<string, YearValueMap> = {};
    for (const code of deptCodes) {
      depts[code] = sumYearMaps(
        parts.map((p) => p.depts[code] ?? emptyYearMap(years)),
        years,
      );
    }
    return { univ, depts };
  };

  const income = sumH(incomeLines);
  const expense = sumH(expenseLines);
  const net: HierarchyValues = {
    univ: composeAccountingNet(income.univ, expense.univ, years),
    depts: Object.fromEntries(
      deptCodes.map((code) => [
        code,
        composeAccountingNet(
          income.depts[code] ?? emptyYearMap(years),
          expense.depts[code] ?? emptyYearMap(years),
          years,
        ),
      ]),
    ),
  };
  return { income, expense, net };
}
