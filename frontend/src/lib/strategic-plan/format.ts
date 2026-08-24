/** 정수는 그대로, 소수는 첫째 자리까지. 값이 없으면 en dash */
export function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  if (Number.isInteger(value)) return value.toLocaleString('ko-KR');
  return (Math.round(value * 10) / 10).toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** 항상 소수 첫째 자리 */
export function fmt1(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return (Math.round(value * 10) / 10).toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function fmtWithUnit(
  value: number | null | undefined,
  unit: string | null | undefined,
): string {
  const base = fmt(value);
  if (base === '–' || !unit) return base;
  return `${base}${unit}`;
}

/** 원 단위 금액. 천 단위 구분만 넣는다. */
export function fmtWon(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return Math.round(value).toLocaleString('ko-KR');
}

/** 입력창 문자열 → 숫자. 공백·쉼표는 허용, 숫자가 아니면 null */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 달성률(%) = 실적 ÷ 목표 × 100 */
export function achievementRate(
  actual: number | null | undefined,
  target: number | null | undefined,
): number | null {
  if (actual === null || actual === undefined || Number.isNaN(actual)) {
    return null;
  }
  if (
    target === null ||
    target === undefined ||
    Number.isNaN(target) ||
    target === 0
  ) {
    return null;
  }
  return (actual / target) * 100;
}
