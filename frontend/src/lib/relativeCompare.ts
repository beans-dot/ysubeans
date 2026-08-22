import type { PivotResult, PivotRow } from '@/lib/api';
import type { SelectedMetric, SelectedTarget } from '@/store/useDashboardStore';

export interface RelativeUnivScore {
  univCode: string;
  label: string;
  isYeonsung: boolean;
  value: number;
  /** 0–100, 비교군 평균 = 50 */
  position: number;
}

/** 지표 × 연도 1개 스케일 */
export interface RelativeYearScale {
  year: number;
  mean: number;
  universities: RelativeUnivScore[];
}

/** 지표별 그룹 (연도 스케일 목록 포함) */
export interface RelativeMetricGroup {
  metricId: number;
  metricName: string;
  metricUnit: string | null;
  scales: RelativeYearScale[];
}

/** @deprecated 호환용 — RelativeYearScale과 동일 필드 + 지표 메타 */
export type RelativeMetricScale = RelativeYearScale & {
  metricId: number;
  metricName: string;
  metricUnit: string | null;
};

/** 대학 단위(학과·계열 제외) 대상에서 대학 코드 수집 */
export function collectUnivLevelCodes(targets: SelectedTarget[]): string[] {
  const codes = new Set<string>();
  for (const t of targets) {
    if (t.memberDeptCodes?.length || t.deptCode) continue;
    if (t.memberUnivCodes?.length) {
      t.memberUnivCodes.forEach((c) => codes.add(c));
      continue;
    }
    if (t.univCode) codes.add(t.univCode);
  }
  return Array.from(codes);
}

/** 우리대학(대학 단위)이 선택돼 있는지 */
export function hasYeonsungUniversity(targets: SelectedTarget[]): boolean {
  return targets.some(
    (t) =>
      t.isYeonsung &&
      !t.deptCode &&
      !(t.memberDeptCodes && t.memberDeptCodes.length > 0),
  );
}

/**
 * 상대비교 표시 조건:
 * - 우리대학(대학 단위) 선택
 * - 타대학 비교(공시) 맥락
 * - 비교 대학이 2개 이상
 * - INTERNAL 단독 조회가 아님
 */
export function shouldShowRelativeCompare(
  targets: SelectedTarget[],
  metrics: SelectedMetric[],
): boolean {
  if (!hasYeonsungUniversity(targets)) return false;
  if (metrics.length === 0) return false;
  if (metrics.every((m) => m.sourceType === 'INTERNAL')) return false;
  if (!targets.some((t) => !t.isYeonsung)) return false;
  return collectUnivLevelCodes(targets).length >= 2;
}

/** 비교군 평균=50, 최솟값→0, 최댓값→100 으로 선형 매핑 */
export function toRelativePosition(
  value: number,
  mean: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value) || !Number.isFinite(mean)) return 50;
  if (max === min) return 50;
  if (value >= mean) {
    if (max === mean) return 50;
    return clamp(50 + ((value - mean) / (max - mean)) * 50, 0, 100);
  }
  if (mean === min) return 50;
  return clamp(50 - ((mean - value) / (mean - min)) * 50, 0, 100);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function univKey(univCode: string) {
  return `${univCode}::_ALL_`;
}

function cleanLabel(label: string) {
  return label.replace(/\s*\(평균\)\s*$/, '');
}

/** 동일 값(동점)끼리 묶기 — Yeonsung 우선 */
export function groupTiedUniversities(
  universities: RelativeUnivScore[],
): RelativeUnivScore[][] {
  const map = new Map<number, RelativeUnivScore[]>();
  for (const u of universities) {
    const list = map.get(u.value);
    if (list) list.push(u);
    else map.set(u.value, [u]);
  }
  return Array.from(map.values()).map((group) =>
    [...group].sort((a, b) => {
      if (a.isYeonsung !== b.isYeonsung) return a.isYeonsung ? -1 : 1;
      return a.label.localeCompare(b.label, 'ko');
    }),
  );
}

/**
 * 개별 대학 피벗 결과 → 지표별(연도별 스케일) 상대비교
 */
export function buildRelativeScales(
  pivot: PivotResult,
  metricIds: number[],
): RelativeMetricGroup[] {
  const yearsDesc = [...pivot.years].sort((a, b) => b - a);
  const groups: RelativeMetricGroup[] = [];

  for (const metricId of metricIds) {
    const rows = pivot.rows.filter(
      (r) =>
        r.metricId === metricId &&
        (!r.deptCode || r.deptCode === '_ALL_'),
    );
    const byUniv = new Map<string, PivotRow>();
    for (const r of rows) {
      const existing = byUniv.get(r.univCode);
      if (!existing || r.targetKey === univKey(r.univCode)) {
        byUniv.set(r.univCode, r);
      }
    }
    if (byUniv.size === 0) continue;

    const sample = byUniv.values().next().value as PivotRow;
    const yearScales: RelativeYearScale[] = [];

    for (const year of yearsDesc) {
      const scored: RelativeUnivScore[] = [];
      for (const row of byUniv.values()) {
        const v = row.values[year];
        if (v === null || v === undefined || !Number.isFinite(v)) continue;
        scored.push({
          univCode: row.univCode,
          label: cleanLabel(row.targetLabel),
          isYeonsung: row.isYeonsung,
          value: v,
          position: 0,
        });
      }
      if (scored.length < 2) continue;

      const values = scored.map((s) => s.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      yearScales.push({
        year,
        mean,
        universities: scored
          .map((s) => ({
            ...s,
            position: toRelativePosition(s.value, mean, min, max),
          }))
          .sort((a, b) => a.position - b.position),
      });
    }

    if (yearScales.length === 0) continue;

    groups.push({
      metricId,
      metricName: sample.metricName,
      metricUnit: sample.metricUnit,
      scales: yearScales,
    });
  }

  return groups;
}

/**
 * 피벗 행(대학·계열·학과)을 그대로 상대비교.
 * focusKeys에 해당하는 대상(대학 전체)만 강조 마커.
 */
export function buildRelativeScalesFromPivotRows(
  pivot: PivotResult,
  metricIds: number[],
  focusKeys: string[] = ['root:yeonsung'],
): RelativeMetricGroup[] {
  const yearsDesc = [...pivot.years].sort((a, b) => b - a);
  const focus = new Set(focusKeys);
  const groups: RelativeMetricGroup[] = [];

  for (const metricId of metricIds) {
    const rows = pivot.rows.filter((r) => r.metricId === metricId);
    const byTarget = new Map<string, PivotRow>();
    for (const r of rows) {
      if (!byTarget.has(r.targetKey)) byTarget.set(r.targetKey, r);
    }
    if (byTarget.size === 0) continue;

    const sample = byTarget.values().next().value as PivotRow;
    const yearScales: RelativeYearScale[] = [];

    for (const year of yearsDesc) {
      const scored: RelativeUnivScore[] = [];
      for (const row of byTarget.values()) {
        const v = row.values[year];
        if (v === null || v === undefined || !Number.isFinite(v)) continue;
        scored.push({
          univCode: row.targetKey,
          label: cleanLabel(row.targetLabel),
          isYeonsung: focus.has(row.targetKey),
          value: v,
          position: 0,
        });
      }
      if (scored.length < 2) continue;

      const values = scored.map((s) => s.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      yearScales.push({
        year,
        mean,
        universities: scored
          .map((s) => ({
            ...s,
            position: toRelativePosition(s.value, mean, min, max),
          }))
          .sort((a, b) => a.position - b.position),
      });
    }

    if (yearScales.length === 0) continue;

    groups.push({
      metricId,
      metricName: sample.metricName,
      metricUnit: sample.metricUnit,
      scales: yearScales,
    });
  }

  return groups;
}
