import type { MetricDirection, YearValueMap, YoySnapshot } from './types';

/** 조회 년도 기준 직전 2년을 포함한 3개년 */
export function trendYearWindow(selectedYear: number): number[] {
  return [selectedYear - 2, selectedYear - 1, selectedYear];
}

export function computeYoy(
  values: YearValueMap,
  years: number[],
  direction: MetricDirection,
  selectedYear?: number,
): YoySnapshot {
  const sorted = [...years].sort((a, b) => a - b);
  const currentYear = selectedYear ?? sorted.at(-1) ?? null;
  if (currentYear == null) {
    return {
      currentYear: null,
      currentValue: null,
      previousYear: null,
      previousValue: null,
      delta: null,
      isImprovement: null,
    };
  }

  const previousYear = currentYear - 1;
  const currentValue = values[currentYear] ?? null;
  const previousValue = values[previousYear] ?? null;
  const delta =
    currentValue != null && previousValue != null
      ? currentValue - previousValue
      : null;

  let isImprovement: boolean | null = null;
  if (delta != null && delta !== 0) {
    const lowerBetter = direction.includes('lower');
    isImprovement = lowerBetter ? delta < 0 : delta > 0;
  }

  return {
    currentYear,
    currentValue,
    previousYear,
    previousValue,
    delta,
    isImprovement,
  };
}
