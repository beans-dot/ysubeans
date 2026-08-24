import type { HighlightBand, MetricDirection } from './types';

export const COMPARE_BAR_COLORS = {
  series: '#1D4ED8',
  /** 학과 기본색. 기존 teal-800(#0F766E)보다 밝되 형광은 피함 */
  dept: '#4DB6AC',
  top: '#90CAF9',
  bottom: '#EF9A9A',
} as const;

function percentileRank(index: number, n: number): number {
  if (n <= 1) return 50;
  return (index / (n - 1)) * 100;
}

/**
 * 동일 위계 집단에서 결측을 제외한 뒤 rank/(n-1)*100.
 * n=1이면 하이라이트 없음.
 */
export function assignHighlightBands(
  items: Array<{ id: string; value: number | null }>,
  direction: MetricDirection,
): Record<string, HighlightBand> {
  const result: Record<string, HighlightBand> = {};
  for (const item of items) result[item.id] = 'none';

  const valid = items.filter(
    (i): i is { id: string; value: number } => i.value != null,
  );
  if (valid.length <= 1) return result;

  const sorted = [...valid].sort((a, b) => a.value - b.value);
  sorted.forEach((item, idx) => {
    const p = percentileRank(idx, sorted.length);
    const highIsGood = direction === 'higher-better';
    if (p >= 90) result[item.id] = highIsGood ? 'top' : 'bottom';
    else if (p <= 10) result[item.id] = highIsGood ? 'bottom' : 'top';
  });
  return result;
}

export function highlightClassName(band: HighlightBand): string {
  if (band === 'top') return 'bg-blue-100';
  if (band === 'bottom') return 'bg-red-100';
  return '';
}

export function highlightBarFill(
  band: HighlightBand,
  kind: 'series' | 'dept',
): string {
  if (band === 'top') return COMPARE_BAR_COLORS.top;
  if (band === 'bottom') return COMPARE_BAR_COLORS.bottom;
  return kind === 'series' ? COMPARE_BAR_COLORS.series : COMPARE_BAR_COLORS.dept;
}
