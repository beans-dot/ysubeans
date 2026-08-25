'use client';

import { create } from 'zustand';
import {
  fetchSpBudgets,
  fetchSpEvaluations,
  fetchSpFundSources,
  fetchSpTree,
  saveSpBudget,
  saveSpEvaluation,
  saveSpKpiResult,
} from '@/lib/strategic-plan/api';
import { parseAmount } from '@/lib/strategic-plan/format';
import type {
  SpBudgetDraft,
  SpEvaluationDraft,
  SpEvaluationTextField,
  SpFundSource,
  SpIrEvalOverlay,
  SpTree,
  SpVision,
} from '@/lib/strategic-plan/types';

export type SpView =
  | 'vision'
  | 'strategy'
  | 'budget'
  | 'eval'
  | 'kpi'
  | 'settlement'
  | 'eval-report';
export type SpCompareMode = 'jc' | 'all' | 'univ';
export type SpKpiSortKey = '' | 'code' | 'baseline' | 'lastTarget';

export const SP_YEAR_VIEWS: SpView[] = [
  'strategy',
  'budget',
  'eval',
  'kpi',
  'settlement',
  'eval-report',
];

export const SP_COMPARE_MODES: Array<{ value: SpCompareMode; label: string }> = [
  { value: 'jc', label: '전문대학 내' },
  { value: 'all', label: '전체(4년제 포함)' },
  { value: 'univ', label: '4년제와 비교' },
];

/** 입력 후 서버 반영까지의 지연 (ms) */
const SAVE_DEBOUNCE_MS = 700;

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSave(key: string, run: () => Promise<void>) {
  const existing = saveTimers.get(key);
  if (existing) clearTimeout(existing);
  saveTimers.set(
    key,
    setTimeout(() => {
      saveTimers.delete(key);
      void run();
    }, SAVE_DEBOUNCE_MS),
  );
}

export function budgetKey(
  taskCode: string,
  subtaskCode: string,
  fundSourceId: number,
) {
  return `${taskCode}::${subtaskCode}::${fundSourceId}`;
}

function defaultYear(years: number[]): number {
  if (years.length === 0) return new Date().getFullYear();
  const current = new Date().getFullYear();
  const past = years.filter((y) => y <= current);
  return past.length > 0 ? Math.max(...past) : years[0];
}

interface StrategicPlanState {
  tree: SpTree | null;
  fundSources: SpFundSource[];
  evaluations: Record<string, SpEvaluationDraft>;
  budgets: SpBudgetDraft;

  loading: boolean;
  entryLoading: boolean;
  error: string | null;
  saveError: string | null;
  pendingSaves: number;

  view: SpView;
  goalId: string;
  dept: string;
  query: string;
  specializedOnly: boolean;
  year: number;
  compareMode: SpCompareMode;
  kpiSort: { key: SpKpiSortKey; dir: 1 | -1 };

  load: () => Promise<void>;
  loadEntries: (year: number) => Promise<void>;
  setView: (view: SpView) => void;
  setGoalId: (goalId: string) => void;
  setDept: (dept: string) => void;
  setQuery: (query: string) => void;
  setSpecializedOnly: (value: boolean) => void;
  setYear: (year: number) => void;
  setCompareMode: (mode: SpCompareMode) => void;
  toggleKpiSort: (key: SpKpiSortKey) => void;
  resetFilters: () => void;

  setEvaluationField: (
    taskCode: string,
    field: SpEvaluationTextField,
    value: string,
  ) => void;
  setEvaluationData: (
    taskCode: string,
    patch: Partial<SpEvaluationDraft>,
  ) => void;
  setIrEvalField: (
    taskCode: string,
    field: keyof SpIrEvalOverlay,
    value: string | Record<string, string>,
  ) => void;
  setBudgetField: (
    taskCode: string,
    subtaskCode: string,
    fundSourceId: number,
    kind: 'budget' | 'settlement',
    value: string,
  ) => void;
  copyPreviousYearBudgets: () => Promise<void>;
  setKpiResult: (kpiCode: string, value: string) => void;
  patchVision: (partial: Partial<SpVision>) => void;
}

export const useStrategicPlanStore = create<StrategicPlanState>((set, get) => ({
  tree: null,
  fundSources: [],
  evaluations: {},
  budgets: {},

  loading: false,
  entryLoading: false,
  error: null,
  saveError: null,
  pendingSaves: 0,

  view: 'vision',
  goalId: '',
  dept: '',
  query: '',
  specializedOnly: false,
  year: new Date().getFullYear(),
  compareMode: 'jc',
  kpiSort: { key: '', dir: 1 },

  load: async () => {
    set({ loading: true, error: null });
    try {
      const latest = await fetchSpTree();
      const year = defaultYear(latest.years);
      const [tree, fundSources] = await Promise.all([
        fetchSpTree(year),
        fetchSpFundSources(false, year),
      ]);
      set({ tree, fundSources, year, loading: false });
      await get().loadEntries(year);
    } catch {
      set({
        loading: false,
        error:
          '중장기발전계획 데이터를 불러오지 못했습니다. 초기 시딩이 끝났는지 확인해 주세요.',
      });
    }
  },

  loadEntries: async (year) => {
    set({ entryLoading: true });
    try {
      const [evaluations, budgets] = await Promise.all([
        fetchSpEvaluations(year),
        fetchSpBudgets(year),
      ]);
      const evalDraft: Record<string, SpEvaluationDraft> = {};
      for (const e of evaluations) {
        evalDraft[e.taskCode] = {
          deptSummary: e.deptSummary ?? '',
          deptAnalysis: e.deptAnalysis ?? '',
          budgetAdequacy: e.budgetAdequacy ?? '',
          budgetAdequacyGrade: e.budgetAdequacyGrade ?? '',
          processAdequacy: e.processAdequacy ?? '',
          processAdequacyGrade: e.processAdequacyGrade ?? '',
          kpiAdequacy: e.kpiAdequacy ?? '',
          kpiAdequacyGrade: e.kpiAdequacyGrade ?? '',
          surveyAnalysis: e.surveyAnalysis ?? '',
          surveyFeedback: e.surveyFeedback ?? '',
          taskActivities: e.taskActivities ?? {},
          kpiPoEvals: e.kpiPoEvals ?? {},
          surveyItems: e.surveyItems ?? [],
          surveyPlans: e.surveyPlans ?? [],
          irEval: e.irEval ?? {},
        };
      }
      const budgetDraft: SpBudgetDraft = {};
      for (const b of budgets) {
        budgetDraft[budgetKey(b.taskCode, b.subtaskCode, b.fundSourceId)] = {
          budget: b.budgetAmount === null ? '' : String(b.budgetAmount),
          settlement:
            b.settlementAmount === null ? '' : String(b.settlementAmount),
        };
      }
      set({
        evaluations: evalDraft,
        budgets: budgetDraft,
        entryLoading: false,
      });
    } catch {
      set({
        entryLoading: false,
        saveError: '연도별 입력값을 불러오지 못했습니다.',
      });
    }
  },

  setView: (view) => set({ view }),
  setGoalId: (goalId) => set({ goalId }),
  setDept: (dept) => set({ dept }),
  setQuery: (query) => set({ query }),
  setSpecializedOnly: (specializedOnly) => set({ specializedOnly }),
  setYear: (year) => {
    set({ year });
    void (async () => {
      try {
        const [tree, fundSources] = await Promise.all([
          fetchSpTree(year),
          fetchSpFundSources(false, year),
        ]);
        set({ tree, fundSources });
      } catch {
        set({ saveError: '해당 학년도 체계를 불러오지 못했습니다.' });
      }
      await get().loadEntries(year);
    })();
  },
  setCompareMode: (compareMode) => set({ compareMode }),
  toggleKpiSort: (key) =>
    set((state) => ({
      kpiSort:
        state.kpiSort.key === key
          ? { key, dir: state.kpiSort.dir === 1 ? -1 : 1 }
          : { key, dir: 1 },
    })),
  resetFilters: () =>
    set({ goalId: '', dept: '', query: '', specializedOnly: false }),

  patchVision: (partial) =>
    set((state) => {
      if (!state.tree) return {};
      const current = state.tree.vision ?? {
        officialName: null,
        planPeriod: null,
        structureSummary: null,
        visionStatement: null,
        visionGoal: null,
        mission: null,
        keyIndicators: [],
        foundingPhilosophy: [],
        mottoPairs: [],
        talent3c: null,
        contentHtml: null,
      };
      return {
        tree: { ...state.tree, vision: { ...current, ...partial } },
      };
    }),

  setEvaluationField: (taskCode, field, value) => {
    const year = get().year;
    set((state) => ({
      evaluations: {
        ...state.evaluations,
        [taskCode]: { ...state.evaluations[taskCode], [field]: value },
      },
      saveError: null,
    }));
    scheduleSave(`eval:${year}:${taskCode}:${field}`, async () => {
      set((s) => ({ pendingSaves: s.pendingSaves + 1 }));
      try {
        await saveSpEvaluation({ taskCode, year, [field]: value });
      } catch {
        set({ saveError: '자체평가 저장에 실패했습니다.' });
      } finally {
        set((s) => ({ pendingSaves: Math.max(0, s.pendingSaves - 1) }));
      }
    });
  },

  setEvaluationData: (taskCode, patch) => {
    const year = get().year;
    const keys = Object.keys(patch).join(',');
    set((state) => {
      const prev = state.evaluations[taskCode] ?? {};
      const merged: SpEvaluationDraft = { ...prev, ...patch };
      if (patch.taskActivities) {
        merged.taskActivities = {
          ...prev.taskActivities,
          ...patch.taskActivities,
        };
      }
      if (patch.kpiPoEvals) {
        merged.kpiPoEvals = { ...prev.kpiPoEvals, ...patch.kpiPoEvals };
      }
      return {
        evaluations: { ...state.evaluations, [taskCode]: merged },
        saveError: null,
      };
    });
    scheduleSave(`eval:${year}:${taskCode}:${keys}`, async () => {
      set((s) => ({ pendingSaves: s.pendingSaves + 1 }));
      try {
        const draft = get().evaluations[taskCode] ?? {};
        const payload: Partial<SpEvaluationDraft> = {};
        for (const key of Object.keys(patch) as Array<keyof SpEvaluationDraft>) {
          (payload as Record<string, unknown>)[key] = draft[key];
        }
        await saveSpEvaluation({ taskCode, year, ...payload });
      } catch {
        set({ saveError: '자체평가 저장에 실패했습니다.' });
      } finally {
        set((s) => ({ pendingSaves: Math.max(0, s.pendingSaves - 1) }));
      }
    });
  },

  setIrEvalField: (taskCode, field, value) => {
    const year = get().year;
    set((state) => {
      const prev = state.evaluations[taskCode]?.irEval ?? {};
      const irEval = { ...prev, [field]: value };
      return {
        evaluations: {
          ...state.evaluations,
          [taskCode]: { ...state.evaluations[taskCode], irEval },
        },
        saveError: null,
      };
    });
    scheduleSave(`eval:${year}:${taskCode}:irEval:${String(field)}`, async () => {
      set((s) => ({ pendingSaves: s.pendingSaves + 1 }));
      try {
        const irEval = get().evaluations[taskCode]?.irEval ?? {};
        await saveSpEvaluation({ taskCode, year, irEval });
      } catch {
        set({ saveError: 'IR평가 저장에 실패했습니다.' });
      } finally {
        set((s) => ({ pendingSaves: Math.max(0, s.pendingSaves - 1) }));
      }
    });
  },

  setBudgetField: (taskCode, subtaskCode, fundSourceId, kind, value) => {
    const year = get().year;
    const key = budgetKey(taskCode, subtaskCode, fundSourceId);
    set((state) => {
      const prev = state.budgets[key] ?? { budget: '', settlement: '' };
      return {
        budgets: { ...state.budgets, [key]: { ...prev, [kind]: value } },
        saveError: null,
      };
    });
    scheduleSave(`budget:${year}:${key}:${kind}`, async () => {
      set((s) => ({ pendingSaves: s.pendingSaves + 1 }));
      try {
        const amount = parseAmount(value);
        if (value.trim() !== '' && amount === null) {
          set({ saveError: '금액은 0 이상의 숫자만 입력할 수 있습니다.' });
          return;
        }
        await saveSpBudget({
          taskCode,
          subtaskCode,
          year,
          fundSourceId,
          ...(kind === 'budget'
            ? { budgetAmount: amount }
            : { settlementAmount: amount }),
        });
      } catch {
        set({ saveError: '예산·결산 저장에 실패했습니다.' });
      } finally {
        set((s) => ({ pendingSaves: Math.max(0, s.pendingSaves - 1) }));
      }
    });
  },

  copyPreviousYearBudgets: async () => {
    const { year, fundSources } = get();
    const prevYear = year - 1;
    set({ saveError: null });
    set((s) => ({ pendingSaves: s.pendingSaves + 1 }));
    try {
      const prev = await fetchSpBudgets(prevYear);
      const activeIds = new Set(fundSources.map((f) => f.fundSourceId));
      const toCopy = prev.filter(
        (b) => b.budgetAmount !== null && activeIds.has(b.fundSourceId),
      );
      if (toCopy.length === 0) {
        set({
          saveError: `${prevYear}학년도 예산이 없어 복사하지 못했습니다.`,
        });
        return;
      }
      const next = { ...get().budgets };
      await Promise.all(
        toCopy.map(async (b) => {
          const key = budgetKey(b.taskCode, b.subtaskCode, b.fundSourceId);
          const current = next[key] ?? { budget: '', settlement: '' };
          next[key] = { ...current, budget: String(b.budgetAmount) };
          await saveSpBudget({
            taskCode: b.taskCode,
            subtaskCode: b.subtaskCode,
            year,
            fundSourceId: b.fundSourceId,
            budgetAmount: b.budgetAmount,
          });
        }),
      );
      set({ budgets: next, saveError: null });
    } catch {
      set({ saveError: '전년도 예산을 복사하지 못했습니다.' });
    } finally {
      set((s) => ({ pendingSaves: Math.max(0, s.pendingSaves - 1) }));
    }
  },

  setKpiResult: (kpiCode, value) => {
    const year = get().year;
    set((state) => {
      if (!state.tree) return {};
      return {
        tree: {
          ...state.tree,
          kpis: state.tree.kpis.map((k) =>
            k.kpiCode === kpiCode
              ? {
                  ...k,
                  results: {
                    ...k.results,
                    [year]: value.trim() === '' ? null : Number(value),
                  },
                }
              : k,
          ),
        },
        saveError: null,
      };
    });
    scheduleSave(`result:${year}:${kpiCode}`, async () => {
      set((s) => ({ pendingSaves: s.pendingSaves + 1 }));
      try {
        const trimmed = value.trim();
        const parsed = trimmed === '' ? null : Number(trimmed);
        if (parsed !== null && !Number.isFinite(parsed)) {
          set({ saveError: '실적값은 숫자만 입력할 수 있습니다.' });
          return;
        }
        await saveSpKpiResult(kpiCode, year, parsed);
      } catch {
        set({ saveError: 'KPI 실적값 저장에 실패했습니다.' });
      } finally {
        set((s) => ({ pendingSaves: Math.max(0, s.pendingSaves - 1) }));
      }
    });
  },
}));
