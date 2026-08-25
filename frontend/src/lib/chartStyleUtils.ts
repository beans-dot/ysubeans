// [강제] Random Color 절대 금지. 배열 초과 시 Modulo 순환 참조.

export const YEONSUNG_COLORS = [
  '#50B1D1',
  '#0F766E',
  '#3B82F6',
  '#0369A1',
  '#4F46E5',
  '#0891B2',
  '#2563EB',
  '#0D9488',
] as const;

export const OTHERS_COLORS = [
  '#C2410C',
  '#EAB308',
  '#B91C1C',
  '#D97706',
  '#BE123C',
  '#F59E0B',
  '#991B1B',
  '#EA580C',
] as const;

export type MarkerShape = 'circle' | 'triangle' | 'square' | 'diamond' | 'wye';

export const MARKER_SHAPES: MarkerShape[] = [
  'circle',
  'triangle',
  'square',
  'diamond',
  'wye',
];

// 'solid'는 undefined 처리
export const LINE_DASHES = ['solid', '5 5', '10 5', '3 3'] as const;

export interface LineStyle {
  stroke: string;
  strokeWidth: number;
  strokeDasharray: string | undefined;
  activeDot: { shape: MarkerShape };
  shape: MarkerShape;
}

/**
 * [할당 함수] 색/마커/선을 배열에서 각각
 *   color : index % 8
 *   shape : Math.floor(index / 8) % 5
 *   dash  : Math.floor(index / 40) % 4
 * 로 연산하여 순환 할당.
 */
export function getLineStyle(isYeonsung: boolean, index: number): LineStyle {
  const palette = isYeonsung ? YEONSUNG_COLORS : OTHERS_COLORS;

  const stroke = palette[index % 8];
  const shape = MARKER_SHAPES[Math.floor(index / 8) % 5];
  const dashToken = LINE_DASHES[Math.floor(index / 40) % 4];

  // 'solid'는 strokeDasharray undefined로 처리
  const strokeDasharray = dashToken === 'solid' ? undefined : dashToken;

  return {
    stroke,
    strokeWidth: isYeonsung ? 3 : 2,
    strokeDasharray,
    activeDot: { shape },
    shape,
  };
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

/**
 * 팔레트 소진 시 그룹 계열(연성=한색, 타대학=난색) 내에서
 * 색상환을 순회하며 아직 사용하지 않은 고유 색을 생성.
 */
function pickUniqueColor(
  used: Set<string>,
  isYeonsung: boolean,
  seed: number,
): string {
  const hueStart = isYeonsung ? 185 : 0; // 연성: 185~260(청록~파랑), 타대학: 0~55(빨강~주황/노랑)
  const hueSpan = isYeonsung ? 75 : 55;
  for (let i = 0; i < 200; i++) {
    const hue = hueStart + (((seed + i) * 17) % hueSpan);
    const sat = 72 - (i % 3) * 12;
    const light = 40 + (i % 5) * 7;
    const color = hslToHex(hue, sat, light);
    if (!used.has(color)) return color;
  }
  return hslToHex(hueStart + (seed % hueSpan), 70, 45);
}

/**
 * 전체 시리즈에 대해 색상이 절대 중복되지 않도록 스타일을 일괄 할당.
 * 색: 그룹 팔레트 우선 → 소진/충돌 시 계열 색상환에서 고유 색 생성
 * 마커/선 종류: 그룹 내 순번으로 순환하여 추가 식별성 확보
 */
export function buildSeriesStyleMap(
  series: Array<{ key: string; isYeonsung: boolean }>,
): Record<string, LineStyle> {
  const used = new Set<string>();
  const map: Record<string, LineStyle> = {};
  let yIdx = 0;
  let oIdx = 0;

  for (const s of series) {
    const groupIndex = s.isYeonsung ? yIdx++ : oIdx++;
    const palette = s.isYeonsung ? YEONSUNG_COLORS : OTHERS_COLORS;

    let stroke: string = palette[groupIndex % palette.length];
    if (used.has(stroke)) {
      stroke = pickUniqueColor(used, s.isYeonsung, groupIndex);
    }
    used.add(stroke);

    const shape =
      MARKER_SHAPES[Math.floor(groupIndex / palette.length) % MARKER_SHAPES.length];
    const dashToken =
      LINE_DASHES[
        Math.floor(groupIndex / (palette.length * MARKER_SHAPES.length)) %
          LINE_DASHES.length
      ];
    const strokeDasharray = dashToken === 'solid' ? undefined : dashToken;

    map[s.key] = {
      stroke,
      strokeWidth: s.isYeonsung ? 3 : 2,
      strokeDasharray,
      activeDot: { shape },
      shape,
    };
  }

  return map;
}
