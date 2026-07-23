'use client';

import { create } from 'zustand';
import { api, type PivotResult, type TargetTreeNode } from '@/lib/api';
import { collapseSelectedTargets } from '@/lib/targetSelection';

export interface SelectedTarget {
  key: string; // 개별: univCode 또는 univCode::deptCode / 그룹: 트리 node.id
  label: string;
  isYeonsung: boolean;
  /** individual = 단일 대학·학과 / group = 위계 평균 */
  mode: 'individual' | 'group';
  univCode?: string;
  deptCode?: string;
  /** group: 소속 대학 평균 (타 대학 위계) */
  memberUnivCodes?: string[];
  /** group: 소속 학과 평균 (계열·연성대 root 위계) */
  memberDeptCodes?: string[];
}

export interface SelectedMetric {
  metricId: number;
  metricName: string;
  sourceType: 'ALIMI' | 'INTERNAL';
  unit: string | null;
}

export interface ChartOptions {
  showDataLabels: boolean;
  showTrendline: boolean;
  showReferenceLine: boolean;
  referenceValue: number;
  /** 선택 데이터(시리즈 key)별 추세선 on/off. key 미존재 시 기본 on 처리 */
  trendlineSeries: Record<string, boolean>;
}

interface DashboardState {
  targetTree: TargetTreeNode[];
  selectedTargets: SelectedTarget[];
  selectedMetrics: SelectedMetric[];
  years: number[];
  chartOptions: ChartOptions;
  /** 하위 위계가 모두 선택되면 상위 위계 평균으로 접기 */
  hierarchyIntegrate: boolean;
  pivot: PivotResult | null;
  loading: boolean;
  presetName: string;

  hasOtherUniversity: () => boolean;

  setTargetTree: (tree: TargetTreeNode[]) => void;
  setHierarchyIntegrate: (value: boolean) => void;
  toggleHierarchyGroup: (group: SelectedTarget, descendantKeys: string[]) => void;
  toggleIndividualTarget: (
    target: SelectedTarget,
    descendantKeys: string[],
  ) => void;
  toggleTarget: (t: SelectedTarget) => void;
  applyTargetSelection: (targets: SelectedTarget[], selected: boolean) => void;
  toggleMetric: (m: SelectedMetric) => void;
  clearTargets: () => void;
  clearMetrics: () => void;
  setYears: (years: number[]) => void;
  deletePreset: (presetId: number) => Promise<void>;
  setChartOption: <K extends keyof ChartOptions>(
    key: K,
    value: ChartOptions[K],
  ) => void;
  setPresetName: (name: string) => void;

  fetchPivot: () => Promise<void>;
  loadPresetState: (state: {
    selectedTargets: SelectedTarget[];
    selectedMetrics: SelectedMetric[];
    years: number[];
    chartOptions?: ChartOptions;
    hierarchyIntegrate?: boolean;
  }) => void;
  serialize: () => Record<string, unknown>;
}

/** 2022년 및 이전 데이터는 현재 조회 불가 */
export const MIN_AVAILABLE_YEAR = 2023;

const currentYear = new Date().getFullYear();
const defaultYears = [0, 1, 2, 3, 4]
  .map((o) => currentYear - o)
  .filter((y) => y >= MIN_AVAILABLE_YEAR)
  .sort((a, b) => a - b);

function filterAvailableYears(years: number[]): number[] {
  return [...years].filter((y) => y >= MIN_AVAILABLE_YEAR).sort((a, b) => a - b);
}

function normalizeTarget(t: SelectedTarget): SelectedTarget {
  const isGroup =
    !!t.memberUnivCodes?.length || !!t.memberDeptCodes?.length;
  return {
    ...t,
    mode: t.mode ?? (isGroup ? 'group' : 'individual'),
  };
}

function toPivotPayload(targets: SelectedTarget[]) {
  return targets.map((t) => {
    const target = normalizeTarget(t);
    if (target.mode === 'group') {
      return {
        groupKey: target.key,
        groupLabel: target.label,
        isYeonsung: target.isYeonsung,
        univCode: target.univCode,
        memberUnivCodes: target.memberUnivCodes,
        memberDeptCodes: target.memberDeptCodes,
      };
    }
    return {
      univCode: target.univCode as string,
      deptCode: target.deptCode,
    };
  });
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  targetTree: [],
  selectedTargets: [],
  selectedMetrics: [],
  years: defaultYears,
  chartOptions: {
    showDataLabels: false,
    showTrendline: false,
    showReferenceLine: false,
    referenceValue: 0,
    trendlineSeries: {},
  },
  hierarchyIntegrate: false,
  pivot: null,
  loading: false,
  presetName: '',

  hasOtherUniversity: () =>
    get().selectedTargets.some((t) => !t.isYeonsung),

  setTargetTree: (tree) => set({ targetTree: tree }),

  setHierarchyIntegrate: (value) => set({ hierarchyIntegrate: value }),

  toggleHierarchyGroup: (group, descendantKeys) =>
    set((state) => {
      const removeKeys = new Set([...descendantKeys, group.key]);
      const exists = state.selectedTargets.some((x) => x.key === group.key);
      const filtered = state.selectedTargets.filter((x) => !removeKeys.has(x.key));
      const nextTargets = exists
        ? filtered
        : [...filtered, normalizeTarget(group)];

      return { selectedTargets: nextTargets };
    }),

  toggleIndividualTarget: (target, descendantKeys) =>
    set((state) => {
      const normalized = normalizeTarget(target);
      const removeKeys = new Set(descendantKeys);
      const exists = state.selectedTargets.some((x) => x.key === normalized.key);
      let nextTargets = state.selectedTargets.filter((x) => !removeKeys.has(x.key));

      if (exists) {
        nextTargets = nextTargets.filter((x) => x.key !== normalized.key);
      } else {
        nextTargets = [...nextTargets, normalized];
      }

      return { selectedTargets: nextTargets };
    }),

  toggleTarget: (t) =>
    set((state) => {
      const target = normalizeTarget(t);
      const exists = state.selectedTargets.find((x) => x.key === target.key);
      const nextTargets = exists
        ? state.selectedTargets.filter((x) => x.key !== target.key)
        : [...state.selectedTargets, target];

      return { selectedTargets: nextTargets };
    }),

  applyTargetSelection: (targets, selected) =>
    set((state) => {
      const normalized = targets.map(normalizeTarget);
      let nextTargets = state.selectedTargets;
      if (selected) {
        const existingKeys = new Set(state.selectedTargets.map((x) => x.key));
        const toAdd = normalized.filter((t) => !existingKeys.has(t.key));
        nextTargets = [...state.selectedTargets, ...toAdd];
      } else {
        const removeKeys = new Set(normalized.map((t) => t.key));
        nextTargets = state.selectedTargets.filter((x) => !removeKeys.has(x.key));
      }

      return { selectedTargets: nextTargets };
    }),

  toggleMetric: (m) =>
    set((state) => {
      if (m.sourceType === 'INTERNAL' && state.selectedTargets.some((t) => !t.isYeonsung)) {
        return state;
      }
      const exists = state.selectedMetrics.find((x) => x.metricId === m.metricId);
      return {
        selectedMetrics: exists
          ? state.selectedMetrics.filter((x) => x.metricId !== m.metricId)
          : [...state.selectedMetrics, m],
      };
    }),

  clearTargets: () => set({ selectedTargets: [] }),
  clearMetrics: () => set({ selectedMetrics: [] }),
  setYears: (years) => set({ years: filterAvailableYears(years) }),
  deletePreset: async (presetId) => {
    await api.delete(`/presets/${presetId}`);
  },
  setChartOption: (key, value) =>
    set((state) => ({
      chartOptions: { ...state.chartOptions, [key]: value },
    })),
  setPresetName: (name) => set({ presetName: name }),

  fetchPivot: async () => {
    const { selectedTargets, selectedMetrics, years, hierarchyIntegrate } = get();
    const hasInternalWithOther =
      selectedMetrics.some((m) => m.sourceType === 'INTERNAL') &&
      selectedTargets.some((t) => !t.isYeonsung);
    if (
      selectedTargets.length === 0 ||
      selectedMetrics.length === 0 ||
      years.length === 0 ||
      hasInternalWithOther
    ) {
      set({ pivot: { years, rows: [] } });
      return;
    }

    let { targetTree } = get();
    if (!targetTree.length) {
      try {
        const { data } = await api.get<TargetTreeNode[]>('/universities/tree');
        targetTree = data;
        set({ targetTree: data });
      } catch {
        targetTree = [];
      }
    }

    const collapsed = collapseSelectedTargets(
      selectedTargets,
      targetTree,
      hierarchyIntegrate,
    );

    set({ loading: true, selectedTargets: collapsed });
    try {
      const { data } = await api.post<PivotResult>('/pivot', {
        targets: toPivotPayload(collapsed),
        metricIds: selectedMetrics.map((m) => m.metricId),
        years,
        hierarchyIntegrate,
      });
      set({ pivot: data });
    } finally {
      set({ loading: false });
    }
  },

  loadPresetState: (state) =>
    set((s) => ({
      selectedTargets: (state.selectedTargets ?? []).map(normalizeTarget),
      selectedMetrics: state.selectedMetrics,
      years: filterAvailableYears(state.years ?? []),
      chartOptions: state.chartOptions
        ? { ...s.chartOptions, ...state.chartOptions }
        : s.chartOptions,
      hierarchyIntegrate: state.hierarchyIntegrate ?? s.hierarchyIntegrate,
    })),

  serialize: () => {
    const {
      selectedTargets,
      selectedMetrics,
      years,
      chartOptions,
      hierarchyIntegrate,
    } = get();
    return {
      selectedTargets,
      selectedMetrics,
      years,
      chartOptions,
      hierarchyIntegrate,
    };
  },
}));
