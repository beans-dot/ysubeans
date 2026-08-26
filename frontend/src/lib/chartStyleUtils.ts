export const MAX_CHART_SERIES = 36;

/** 기존 연성 3 / 타대 2 의 50% */
export const CHART_STROKE_WIDTH = {
  yeonsungBase: 1.5,
  othersBase: 1,
  yeonsungEmphasized: 3,
  othersEmphasized: 2,
} as const;

/**
 * 지표 1: 파랑 → 초록 → 보라
 * 지표 2: 빨강 → 주황 → 노랑
 * 이후 지표는 같은 순서를 채도 70%(−30%)로 반복
 */
const HUE_FAMILIES: readonly (readonly number[])[] = [
  [210, 145, 280],
  [0, 28, 48],
];

/** 색량 100% / 60% / 36% → 흰색 혼합 비율 */
const WHITE_MIX = [0, 0.4, 0.64] as const;
const SAT_FACTORS = [1, 0.7] as const;

export const MARKER_SHAPES = [
  'circle',
  'triangle',
  'square',
  'diamond',
  'wye',
] as const;

export type MarkerShape = (typeof MARKER_SHAPES)[number];

export const LINE_DASHES = ['solid', '5 5', '10 5', '3 3'] as const;

export interface LineStyle {
  stroke: string;
  strokeWidth: number;
  emphasizedStrokeWidth: number;
  strokeDasharray: string | undefined;
  activeDot: { shape: MarkerShape };
  shape: MarkerShape;
}

export interface SeriesStyleAssignment {
  styles: Record<string, LineStyle>;
  visibleKeys: string[];
  truncated: boolean;
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  const hh = ((h % 360) + 360) % 360;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function mixHexWithWhite(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = Math.min(1, Math.max(0, t));
  const mix = (c: number) => Math.round(c + (255 - c) * k);
  return `#${[mix(r), mix(g), mix(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function colorForSlot(metricIndex: number, targetIndex: number): string {
  const family = HUE_FAMILIES[metricIndex % 2];
  const satCycle = Math.floor(metricIndex / 2) + Math.floor(targetIndex / 9);
  const sat = 78 * SAT_FACTORS[satCycle % SAT_FACTORS.length];
  const hue = family[Math.floor(targetIndex / 3) % family.length];
  const base = hslToHex(hue, sat, 40);
  return mixHexWithWhite(base, WHITE_MIX[targetIndex % 3]);
}

export function orderSeriesForChart<
  T extends { key: string; isYeonsung: boolean; metricId: number },
>(series: T[]): T[] {
  const metricOrder: number[] = [];
  for (const s of series) {
    if (!metricOrder.includes(s.metricId)) metricOrder.push(s.metricId);
  }
  const ordered: T[] = [];
  for (const metricId of metricOrder) {
    const group = series.filter((s) => s.metricId === metricId);
    ordered.push(
      ...group.filter((s) => s.isYeonsung),
      ...group.filter((s) => !s.isYeonsung),
    );
  }
  return ordered;
}

/**
 * 지표별로 다른 색 계열, 조회대상은 연성대를 가장 진하게 두고 3개까지 밝기를 낮춘다.
 * 6색 × 3밝기 = 18선, 그다음 채도 −30%로 18선. 최대 36선.
 */
export function buildSeriesStyleMap(
  series: Array<{ key: string; isYeonsung: boolean; metricId: number }>,
): SeriesStyleAssignment {
  const ordered = orderSeriesForChart(series);
  const visible = ordered.slice(0, MAX_CHART_SERIES);
  const styles: Record<string, LineStyle> = {};

  const metricOrder: number[] = [];
  for (const s of visible) {
    if (!metricOrder.includes(s.metricId)) metricOrder.push(s.metricId);
  }

  const targetIndexByMetric = new Map<number, number>();
  for (const s of visible) {
    const metricIndex = metricOrder.indexOf(s.metricId);
    const targetIndex = targetIndexByMetric.get(s.metricId) ?? 0;
    targetIndexByMetric.set(s.metricId, targetIndex + 1);

    const shape = MARKER_SHAPES[targetIndex % MARKER_SHAPES.length];
    const dashToken =
      LINE_DASHES[Math.floor(targetIndex / MARKER_SHAPES.length) % LINE_DASHES.length];
    const strokeDasharray = dashToken === 'solid' ? undefined : dashToken;

    styles[s.key] = {
      stroke: colorForSlot(metricIndex, targetIndex),
      strokeWidth: s.isYeonsung
        ? CHART_STROKE_WIDTH.yeonsungBase
        : CHART_STROKE_WIDTH.othersBase,
      emphasizedStrokeWidth: s.isYeonsung
        ? CHART_STROKE_WIDTH.yeonsungEmphasized
        : CHART_STROKE_WIDTH.othersEmphasized,
      strokeDasharray,
      activeDot: { shape },
      shape,
    };
  }

  return {
    styles,
    visibleKeys: visible.map((s) => s.key),
    truncated: ordered.length > MAX_CHART_SERIES,
  };
}

/** @deprecated HybridChart는 buildSeriesStyleMap을 사용 */
export function getLineStyle(isYeonsung: boolean, index: number): LineStyle {
  return {
    stroke: colorForSlot(isYeonsung ? 0 : 1, index),
    strokeWidth: isYeonsung
      ? CHART_STROKE_WIDTH.yeonsungBase
      : CHART_STROKE_WIDTH.othersBase,
    emphasizedStrokeWidth: isYeonsung
      ? CHART_STROKE_WIDTH.yeonsungEmphasized
      : CHART_STROKE_WIDTH.othersEmphasized,
    strokeDasharray: undefined,
    activeDot: { shape: MARKER_SHAPES[index % MARKER_SHAPES.length] },
    shape: MARKER_SHAPES[index % MARKER_SHAPES.length],
  };
}
