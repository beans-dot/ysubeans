import type { PivotResult } from './api';

/** 천단위 구분 + 소수점 최대 2자리 */
export function formatNumber(
  value: number | null | undefined,
  _unit?: string | null,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return Number(value).toLocaleString('ko-KR', {
    maximumFractionDigits: 2,
  });
}

export function isPercentUnit(unit?: string | null): boolean {
  return unit === '%' || unit === '퍼센트';
}

/** 단위 비교용 정규화 (%, 퍼센트 → '%') */
export function normalizeUnit(unit?: string | null): string {
  if (!unit) return '';
  if (isPercentUnit(unit)) return '%';
  return unit.trim();
}

export type ChartScaleMode = 'absolute' | 'index';

export type YAxisSide = 'left' | 'right';

/**
 * 피벗 결과를 Recharts용 데이터로 변환.
 * 각 연도별 포인트에 시리즈 키(seriesKey)별 값 매핑.
 */
export interface ChartSeries {
  key: string;
  label: string;
  isYeonsung: boolean;
  unit: string | null;
  /** 절대값 모드 다중 축 할당 */
  yAxisId?: YAxisSide;
}

export interface ChartTransform {
  data: Array<Record<string, number | string | null>>;
  series: ChartSeries[];
  yMin: number;
  yMax: number;
  hasPercent: boolean;
  /** 서로 다른 단위가 2개 이상이면 true */
  unitClash: boolean;
  uniqueUnits: string[];
}

export function pivotToChart(pivot: PivotResult): ChartTransform {
  const series: ChartSeries[] = pivot.rows.map((r) => ({
    key: `${r.targetKey}__${r.metricId}`,
    label: `${r.targetLabel} · ${r.metricName}`,
    isYeonsung: r.isYeonsung,
    unit: r.metricUnit,
  }));

  const data = pivot.years.map((year) => {
    const point: Record<string, number | string | null> = { year };
    pivot.rows.forEach((r) => {
      point[`${r.targetKey}__${r.metricId}`] = r.values[year] ?? null;
    });
    return point;
  });

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let hasPercent = false;
  pivot.rows.forEach((r) => {
    if (isPercentUnit(r.metricUnit)) hasPercent = true;
    pivot.years.forEach((year) => {
      const v = r.values[year];
      if (v !== null && v !== undefined) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    });
  });
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 100;

  const uniqueUnits = [
    ...new Set(series.map((s) => normalizeUnit(s.unit)).filter(Boolean)),
  ];
  // 단위 없음('')도 하나의 단위 그룹으로 취급
  const unitKeys = [
    ...new Set(series.map((s) => normalizeUnit(s.unit) || '__none__')),
  ];
  const unitClash = unitKeys.length > 1;

  return {
    data,
    series,
    yMin: min,
    yMax: max,
    hasPercent,
    unitClash,
    uniqueUnits,
  };
}

/** 시리즈 키 집합에 대한 수치 min/max */
export function computeSeriesExtent(
  data: Array<Record<string, number | string | null>>,
  keys: string[],
): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const row of data) {
    for (const key of keys) {
      const v = row[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 100;
  return { min, max };
}

/**
 * 절대값 모드 도메인: dataMin - 2 ~ dataMax + 2
 * (미세 구간도 차트 전체 높이로 핏)
 */
export function computeAbsoluteDomain(
  data: Array<Record<string, number | string | null>>,
  keys: string[],
): [number, number] {
  const { min, max } = computeSeriesExtent(data, keys);
  if (min === max) {
    return [min - 2, max + 2];
  }
  return [min - 2, max + 2];
}

/**
 * Index 모드 도메인: [max(0, min-2), 105]
 */
export function computeIndexDomain(
  data: Array<Record<string, number | string | null>>,
  keys: string[],
): [number, number] {
  const { min } = computeSeriesExtent(data, keys);
  return [Math.max(0, min - 2), 105];
}

/**
 * 도메인을 지정한 구간 수(segments)로 균등 분할한 눈금 배열 생성.
 * segments=10 → 11개 눈금(맨 아래 기준선 + 그 위 9개 보조선 + 상단선).
 */
export function makeEvenTicks(
  [min, max]: [number, number],
  segments = 10,
): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [min, max];
  }
  const step = (max - min) / segments;
  return Array.from({ length: segments + 1 }, (_, i) => {
    const v = min + step * i;
    // 부동소수 오차 정리
    return Math.round(v * 1e6) / 1e6;
  });
}

/**
 * 단위별 좌/우 Y축 할당.
 * 첫 번째 단위 그룹 → left, 나머지 → right
 */
export function assignDualYAxes(series: ChartSeries[]): ChartSeries[] {
  const order: string[] = [];
  for (const s of series) {
    const u = normalizeUnit(s.unit) || '__none__';
    if (!order.includes(u)) order.push(u);
  }
  const leftUnit = order[0];
  return series.map((s) => {
    const u = normalizeUnit(s.unit) || '__none__';
    return { ...s, yAxisId: u === leftUnit ? 'left' : 'right' };
  });
}

export interface IndexTransformResult {
  /** Index로 치환된 차트 데이터 */
  data: Array<Record<string, number | string | null>>;
  /** 시리즈별 기간 내 최댓값 (Index 100 기준) */
  seriesMax: Record<string, number>;
}

/**
 * 각 시리즈의 조회 기간 최댓값을 100으로 두고
 * (값 / 최댓값) * 100 지수화.
 */
export function toIndex100(
  data: Array<Record<string, number | string | null>>,
  series: ChartSeries[],
): IndexTransformResult {
  const seriesMax: Record<string, number> = {};
  for (const s of series) {
    let max = Number.NEGATIVE_INFINITY;
    for (const row of data) {
      const v = row[s.key];
      if (typeof v === 'number' && Number.isFinite(v) && v > max) max = v;
    }
    seriesMax[s.key] = Number.isFinite(max) && max !== 0 ? max : 1;
  }

  const indexed = data.map((row) => {
    const point: Record<string, number | string | null> = { year: row.year };
    for (const s of series) {
      const v = row[s.key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        point[s.key] = (v / seriesMax[s.key]) * 100;
      } else {
        point[s.key] = null;
      }
    }
    return point;
  });

  return { data: indexed, seriesMax };
}

/** 원값 + 단위 표기 (툴팁/라벨용) */
export function formatValueWithUnit(
  value: unknown,
  unit?: string | null,
): string {
  const formatted = formatNumber(
    typeof value === 'number' ? value : Number(value),
  );
  if (formatted === '-') return '-';
  const u = unit?.trim();
  if (!u) return formatted;
  return `${formatted}${u}`;
}
