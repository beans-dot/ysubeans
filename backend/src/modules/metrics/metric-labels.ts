import { EntityManager, DataSource } from 'typeorm';

/** 학과 단위 조회가 가능한 지표명 접미사 */
export const DEPT_LEVEL_METRIC_SUFFIX = '(학과별)';

/** 과거 학과단위 표기(졸업자 수(학과) 등) */
const LEGACY_DEPT_SUFFIX = '(학과)';

export function hasDeptLevelMetricSuffix(metricName: string): boolean {
  return metricName.trimEnd().endsWith(DEPT_LEVEL_METRIC_SUFFIX);
}

/**
 * 지표명에서 (학과별) 및 레거시 (학과) 접미사를 제거한 기본명.
 */
export function stripDeptLevelMetricSuffix(metricName: string): string {
  let name = metricName.trim();
  if (name.endsWith(DEPT_LEVEL_METRIC_SUFFIX)) {
    name = name.slice(0, -DEPT_LEVEL_METRIC_SUFFIX.length);
  }
  if (name.endsWith(LEGACY_DEPT_SUFFIX)) {
    name = name.slice(0, -LEGACY_DEPT_SUFFIX.length);
  }
  return name;
}

/** 학과별 조회 가능 지표명으로 정규화 */
export function withDeptLevelMetricSuffix(metricName: string): string {
  return `${stripDeptLevelMetricSuffix(metricName)}${DEPT_LEVEL_METRIC_SUFFIX}`;
}

/** ensureMetric 조회용 후보명 (기본명 / (학과별) / 레거시 (학과)) */
export function metricNameLookupCandidates(metricName: string): string[] {
  const base = stripDeptLevelMetricSuffix(metricName);
  return Array.from(
    new Set([
      metricName,
      base,
      withDeptLevelMetricSuffix(base),
      `${base}${LEGACY_DEPT_SUFFIX}`,
    ]),
  );
}

/**
 * ir_raw_data에 학과 단위(_ALL_ 아님) 행이 있는 지표의 metric_name에
 * 반드시 (학과별) 접미사를 붙인다. 배치·엑셀 업로드 직후 호출.
 */
export async function syncDeptLevelMetricNames(
  db: DataSource | EntityManager,
): Promise<number> {
  const rows: Array<{ metric_id: number; metric_name: string }> = await db.query(
    `
    SELECT DISTINCT m.metric_id, m.metric_name
    FROM ir_metric_registry m
    INNER JOIN ir_raw_data r ON r.metric_id = m.metric_id
    WHERE r.dept_code <> '_ALL_'
      AND RIGHT(m.metric_name, $1) IS DISTINCT FROM $2
    `,
    [DEPT_LEVEL_METRIC_SUFFIX.length, DEPT_LEVEL_METRIC_SUFFIX],
  );

  for (const row of rows) {
    await db.query(
      `UPDATE ir_metric_registry SET metric_name = $1 WHERE metric_id = $2`,
      [withDeptLevelMetricSuffix(row.metric_name), row.metric_id],
    );
  }
  return rows.length;
}
