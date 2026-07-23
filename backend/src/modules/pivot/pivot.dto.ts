export interface PivotTargetDto {
  /** 개별 대학/학과 조회 시 */
  univCode?: string;
  deptCode?: string; // 미지정 시 대학 전체(집계)
  /** 위계 그룹 평균 조회 시 */
  groupKey?: string;
  groupLabel?: string;
  isYeonsung?: boolean;
  /** 소속 대학 평균 (타 대학 위계) */
  memberUnivCodes?: string[];
  /** 소속 학과 평균 (계열 위계, univCode와 함께) */
  memberDeptCodes?: string[];
}

export interface PivotQueryDto {
  targets: PivotTargetDto[];
  metricIds: number[];
  years: number[];
  /** true면 하위 위계가 모두 선택됐을 때 상위 평균으로 접기 */
  hierarchyIntegrate?: boolean;
}

export interface PivotRow {
  targetKey: string;
  targetLabel: string;
  univCode: string;
  deptCode: string | null;
  isYeonsung: boolean;
  metricId: number;
  metricName: string;
  metricUnit: string | null;
  aggregationType: string;
  values: Record<number, number | null>;
}

export interface PivotResult {
  years: number[];
  rows: PivotRow[];
}
