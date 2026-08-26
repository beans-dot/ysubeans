export const UNCATEGORIZED_SERIES_NAME = '미분류';
export const INTERNAL_DEPT_CODE_PREFIX = 'INT-';
export const SERIES_CODE_PREFIX = 'SER-';
export const UNCATEGORIZED_SERIES_CODE = 'SER-UNCAT';
export const OFFICE_CODE_PREFIX = 'OFF-';
export const OFFICE_CATEGORY_CODE_PREFIX = 'OFF-CAT-';

/** 기존 조직은 이 학년도부터 살아 있던 것으로 백필한다. */
export const ORG_MIN_YEAR = 2018;

/** 조회·이력용 상한. 관리 화면 선택 범위와는 별개다. */
export const ORG_MAX_YEAR = 2035;

function calendarYear(): number {
  return new Date().getFullYear();
}

/** 조직관리 변경 적용 학년도: 올해 −5 ~ +1 (해가 바뀌면 자동). */
export function orgYears(): number[] {
  const now = calendarYear();
  const from = now - 5;
  const to = now + 1;
  const years: number[] = [];
  for (let y = from; y <= to; y += 1) years.push(y);
  return years;
}

export function defaultOrgYear(): number {
  return calendarYear();
}

export function activeAt(
  effectiveFrom: number,
  abolishedFrom: number | null | undefined,
  year: number,
): boolean {
  return effectiveFrom <= year && (abolishedFrom == null || year < abolishedFrom);
}

export function versionCovers(
  effectiveFrom: number,
  effectiveTo: number | null | undefined,
  year: number,
): boolean {
  return effectiveFrom <= year && (effectiveTo == null || year <= effectiveTo);
}

export type OrgNodeKind = 'series' | 'department' | 'office';
export type OrgChangeType = 'create' | 'update' | 'abolish' | 'rollback';
