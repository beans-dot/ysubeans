import {
  api,
  excludeHiddenFromTree,
  fetchMonitoringYears,
  type CategoryTreeNode,
  type PivotResult,
  type PivotRow,
  type TargetTreeNode,
} from '@/lib/api';
import { hasHierarchyData, readYearValue } from './aggregate';
import { MONITORING_KPI_MAP, STUDENT_COUNT_COMPONENT_SHORT_LABELS } from './catalog';
import { composeAccountingHierarchy } from './composeAccounting';
import {
  composeStudentCountHierarchy,
  emptyYearMap,
  selectedComponentKeys,
} from './composeStudentCount';
import { allDeptCodes, parseOrgTree } from './orgTree';
import {
  resolveCategoryTitles,
  resolveMonitoringMetrics,
} from './resolveMetrics';
import type {
  HierarchyValues,
  MonitoringCategoryDef,
  MonitoringKpiDef,
  MonitoringKpiId,
  OrgStructure,
  StudentCountBreakdown,
  StudentCountComponentKey,
  StudentCountToggles,
  YearValueMap,
  YoySnapshot,
} from './types';
import { computeYoy, trendYearWindow } from './yoy';

export interface MonitoringBundle {
  /** 피벗에 요청한 전체 연도 (추이 창 포함) */
  years: number[];
  /** DB에 모니터링 값이 있는 연도 (조회 년도 드롭다운) */
  availableYears: number[];
  org: OrgStructure;
  /** 시드 카테고리 코드 → 현재 카테고리명 (지표 DB 빌더에서 바꾼 이름) */
  categoryTitles: Record<string, string>;
  /** DB 트리에 실제로 존재하는 섹션·KPI만 (삭제·숨김 제외) */
  sections: MonitoringCategoryDef[];
  directs: Record<
    string,
    {
      kpi: MonitoringKpiDef;
      label: string;
      unit: string | null;
      found: boolean;
      values: HierarchyValues;
    }
  >;
  studentComponents: Record<StudentCountComponentKey, HierarchyValues>;
  studentMeta: {
    kpi: MonitoringKpiDef;
    label: string;
    unit: string | null;
    found: boolean;
  };
  accountings: Record<
    string,
    {
      kpi: MonitoringKpiDef;
      label: string;
      unit: string | null;
      found: boolean;
      income: HierarchyValues;
      expense: HierarchyValues;
      net: HierarchyValues;
      incomeLines: { name: string; values: HierarchyValues }[];
      expenseLines: { name: string; values: HierarchyValues }[];
    }
  >;
}

export interface KpiViewModel {
  id: MonitoringKpiId;
  label: string;
  unit: string | null;
  found: boolean;
  hasHierarchy: boolean;
  selectedYear: number;
  years: number[];
  univ: YearValueMap;
  depts: Record<string, YearValueMap>;
  yoy: YoySnapshot;
  kpi: MonitoringKpiDef;
  /** 재학생 수: 켠 구성 항목별 학과 값 (비교 누적 차트용) */
  studentBreakdown?: StudentCountBreakdown;
  accounting?: {
    income: YearValueMap;
    expense: YearValueMap;
    incomeDepts: Record<string, YearValueMap>;
    expenseDepts: Record<string, YearValueMap>;
    incomeYoy: YoySnapshot;
    expenseYoy: YoySnapshot;
    incomeLines: { name: string; univ: YearValueMap }[];
    expenseLines: { name: string; univ: YearValueMap }[];
  };
}

function fallbackCalendarYears(): number[] {
  return trendYearWindow(new Date().getFullYear());
}

function uniqueSortedYears(years: number[]): number[] {
  return [...new Set(years)].filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
}

/** 선택 가능한 연도마다 직전 2년이 피벗에 포함되도록 확장 */
function pivotYearsFor(availableYears: number[]): number[] {
  if (availableYears.length === 0) return fallbackCalendarYears();
  const min = Math.min(...availableYears);
  const max = Math.max(...availableYears);
  const years: number[] = [];
  for (let y = min - 2; y <= max; y++) years.push(y);
  return years;
}

function extractHierarchy(
  rows: PivotRow[],
  metricIds: number[],
  years: number[],
  univCode: string,
  deptCodes: string[],
): HierarchyValues {
  const idSet = new Set(metricIds);
  const relevant = rows.filter((r) => idSet.has(r.metricId));

  const yearMapFrom = (row: PivotRow | undefined): YearValueMap => {
    const map = emptyYearMap(years);
    if (!row) return map;
    for (const year of years) {
      map[year] = readYearValue(row.values, year);
    }
    return map;
  };

  const univRow = relevant.find((r) => r.univCode === univCode && !r.deptCode);
  const depts: Record<string, YearValueMap> = {};
  for (const code of deptCodes) {
    const row = relevant.find(
      (r) => r.univCode === univCode && r.deptCode === code,
    );
    depts[code] = yearMapFrom(row);
  }
  return { univ: yearMapFrom(univRow), depts };
}

function emptyHierarchy(
  years: number[],
  deptCodes: string[],
): HierarchyValues {
  return {
    univ: emptyYearMap(years),
    depts: Object.fromEntries(deptCodes.map((c) => [c, emptyYearMap(years)])),
  };
}

export async function fetchMonitoringBundle(): Promise<MonitoringBundle> {
  const [rawYears, metricRes, treeRes] = await Promise.all([
    fetchMonitoringYears().catch(() => [] as number[]),
    api.get<CategoryTreeNode[]>('/metrics/tree', {
      params: { sourceType: 'MONITORING' },
    }),
    api.get<TargetTreeNode[]>('/universities/tree', {
      params: { scope: 'internal' },
    }),
  ]);

  let availableYears = uniqueSortedYears(rawYears).reverse();
  if (availableYears.length === 0) {
    availableYears = [...fallbackCalendarYears()].reverse();
  }
  const years = pivotYearsFor([...availableYears].sort((a, b) => a - b));

  const visibleTree = excludeHiddenFromTree(metricRes.data);
  const resolved = resolveMonitoringMetrics(visibleTree);
  const categoryTitles = resolveCategoryTitles(visibleTree);
  const org = parseOrgTree(treeRes.data);
  if (!org) {
    throw new Error('내부 편제(대학) 정보를 찾을 수 없습니다.');
  }

  const deptCodes = allDeptCodes(org);
  const studentKpi =
    resolved.composite?.kpi ?? MONITORING_KPI_MAP['student-count'];
  const studentMeta = {
    kpi: studentKpi,
    label: resolved.composite?.label ?? studentKpi.label,
    unit: resolved.composite?.unit ?? studentKpi.fallbackUnit,
    found: resolved.composite?.found ?? false,
  };

  const studentComponents = {
    inner: emptyHierarchy(years, deptCodes),
    outer: emptyHierarchy(years, deptCodes),
    leave: emptyHierarchy(years, deptCodes),
    deferred: emptyHierarchy(years, deptCodes),
  } as Record<StudentCountComponentKey, HierarchyValues>;

  const directs: MonitoringBundle['directs'] = {};
  const accountings: MonitoringBundle['accountings'] = {};

  const emptyAccounting = () => {
    for (const a of resolved.accountings) {
      accountings[a.kpi.id] = {
        kpi: a.kpi,
        label: a.label,
        unit: a.unit,
        found: false,
        income: emptyHierarchy(years, deptCodes),
        expense: emptyHierarchy(years, deptCodes),
        net: emptyHierarchy(years, deptCodes),
        incomeLines: [],
        expenseLines: [],
      };
    }
  };

  if (resolved.allMetricIds.length === 0) {
    for (const d of resolved.directs) {
      directs[d.kpi.id] = {
        kpi: d.kpi,
        label: d.label,
        unit: d.unit,
        found: false,
        values: emptyHierarchy(years, deptCodes),
      };
    }
    emptyAccounting();
    return {
      years,
      availableYears,
      org,
      categoryTitles,
      sections: resolved.sections,
      directs,
      studentComponents,
      studentMeta,
      accountings,
    };
  }

  const targets = [
    { univCode: org.univCode },
    ...deptCodes.map((deptCode) => ({ univCode: org.univCode, deptCode })),
  ];

  const { data: pivot } = await api.post<PivotResult>('/pivot', {
    targets,
    metricIds: resolved.allMetricIds,
    years,
    hierarchyIntegrate: false,
  });

  const rows = pivot.rows ?? [];

  for (const d of resolved.directs) {
    directs[d.kpi.id] = {
      kpi: d.kpi,
      label: d.label,
      unit: d.unit,
      found: d.found,
      values: extractHierarchy(
        rows,
        d.metricIds,
        years,
        org.univCode,
        deptCodes,
      ),
    };
  }

  if (resolved.composite) {
    (Object.keys(resolved.composite.components) as StudentCountComponentKey[]).forEach(
      (key) => {
        const comp = resolved.composite!.components[key];
        studentComponents[key] = extractHierarchy(
          rows,
          comp.metricIds,
          years,
          org.univCode,
          deptCodes,
        );
      },
    );
  }

  for (const a of resolved.accountings) {
    const incomeLines = a.incomeLines.map((line) => ({
      name: line.name,
      values: extractHierarchy(
        rows,
        line.metricIds,
        years,
        org.univCode,
        deptCodes,
      ),
    }));
    const expenseLines = a.expenseLines.map((line) => ({
      name: line.name,
      values: extractHierarchy(
        rows,
        line.metricIds,
        years,
        org.univCode,
        deptCodes,
      ),
    }));
    const composed = composeAccountingHierarchy(
      incomeLines.map((l) => l.values),
      expenseLines.map((l) => l.values),
      years,
      deptCodes,
    );
    accountings[a.kpi.id] = {
      kpi: a.kpi,
      label: a.label,
      unit: a.unit,
      found: a.found,
      income: composed.income,
      expense: composed.expense,
      net: composed.net,
      incomeLines,
      expenseLines,
    };
  }

  return {
    years,
    availableYears,
    org,
    categoryTitles,
    sections: resolved.sections,
    directs,
    studentComponents,
    studentMeta,
    accountings,
  };
}

export function buildKpiViews(
  bundle: MonitoringBundle,
  toggles: StudentCountToggles,
  selectedYear: number,
): KpiViewModel[] {
  const org = bundle.org;
  const years = trendYearWindow(selectedYear);
  const deptCodes = allDeptCodes(org);
  const views: KpiViewModel[] = [];

  const studentValues = composeStudentCountHierarchy(
    bundle.studentComponents,
    toggles,
    years,
    deptCodes,
  );
  const studentKeys = selectedComponentKeys(toggles);
  if (bundle.studentMeta.found) {
    const studentBreakdown: StudentCountBreakdown | undefined =
      studentKeys.length > 0
        ? {
            keys: studentKeys,
            labels: STUDENT_COUNT_COMPONENT_SHORT_LABELS,
            depts: Object.fromEntries(
              studentKeys.map((key) => [
                key,
                bundle.studentComponents[key]?.depts ?? {},
              ]),
            ) as StudentCountBreakdown['depts'],
          }
        : undefined;
    views.push({
      id: 'student-count',
      label: bundle.studentMeta.label,
      unit: bundle.studentMeta.unit,
      found: bundle.studentMeta.found,
      hasHierarchy: hasHierarchyData(studentValues.depts),
      selectedYear,
      years,
      univ: studentValues.univ,
      depts: studentValues.depts,
      yoy: computeYoy(
        studentValues.univ,
        years,
        bundle.studentMeta.kpi.direction,
        selectedYear,
      ),
      kpi: bundle.studentMeta.kpi,
      studentBreakdown,
    });
  }

  for (const [id, entry] of Object.entries(bundle.directs)) {
    if (!entry.found) continue;
    views.push({
      id: id as MonitoringKpiId,
      label: entry.label,
      unit: entry.unit,
      found: entry.found,
      hasHierarchy: hasHierarchyData(entry.values.depts),
      selectedYear,
      years,
      univ: entry.values.univ,
      depts: entry.values.depts,
      yoy: computeYoy(entry.values.univ, years, entry.kpi.direction, selectedYear),
      kpi: entry.kpi,
    });
  }

  for (const [id, entry] of Object.entries(bundle.accountings)) {
    if (!entry.found) continue;
    views.push({
      id: id as MonitoringKpiId,
      label: entry.label,
      unit: entry.unit,
      found: entry.found,
      hasHierarchy:
        hasHierarchyData(entry.income.depts) ||
        hasHierarchyData(entry.expense.depts),
      selectedYear,
      years,
      univ: entry.income.univ,
      depts: entry.income.depts,
      yoy: computeYoy(entry.income.univ, years, entry.kpi.direction, selectedYear),
      kpi: entry.kpi,
      accounting: {
        income: entry.income.univ,
        expense: entry.expense.univ,
        incomeDepts: entry.income.depts,
        expenseDepts: entry.expense.depts,
        incomeYoy: computeYoy(
          entry.income.univ,
          years,
          entry.kpi.direction,
          selectedYear,
        ),
        expenseYoy: computeYoy(
          entry.expense.univ,
          years,
          entry.kpi.direction,
          selectedYear,
        ),
        incomeLines: entry.incomeLines.map((l) => ({
          name: l.name,
          univ: l.values.univ,
        })),
        expenseLines: entry.expenseLines.map((l) => ({
          name: l.name,
          univ: l.values.univ,
        })),
      },
    });
  }

  return views;
}
