'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { achievementRate, fmt, fmt1 } from '@/lib/strategic-plan/format';
import { goalAccent } from '@/lib/strategic-plan/goalAccent';
import type { SpKpi, SpTask } from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import {
  useStrategicPlanStore,
  type SpKpiSortKey,
} from '@/store/useStrategicPlanStore';
import { EmptyState, SectionLabel } from './ui';

function sortValue(kpi: SpKpi, key: SpKpiSortKey, year: number) {
  if (key === 'code') return kpi.kpiCode;
  if (key === 'baseline') return kpi.baseline;
  if (key === 'lastTarget') return kpi.targets[year] ?? null;
  return null;
}

function DetailRow({
  kpi,
  task,
  years,
  colSpan,
}: {
  kpi: SpKpi;
  task: SpTask | undefined;
  years: number[];
  colSpan: number;
}) {
  return (
    <tr className="bg-muted/30">
      <td colSpan={colSpan} className="px-3 py-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SectionLabel>산출식</SectionLabel>
            <p className="text-sm">{kpi.formula ?? '–'}</p>
          </div>
          <div>
            <SectionLabel>소속 실행과제</SectionLabel>
            <p className="text-sm">
              {task ? `${task.taskCode} · ${task.taskName}` : '–'}
            </p>
          </div>
          <div>
            <SectionLabel>책임부서</SectionLabel>
            <p className="text-sm">{task?.primaryDept ?? '–'}</p>
          </div>
          <div>
            <SectionLabel>기준값 참조</SectionLabel>
            <p className="text-sm">
              {fmt(kpi.baseline)}
              {kpi.unit ?? ''}
              {kpi.baselineRef ? ` (${kpi.baselineRef})` : ''}
            </p>
          </div>
          <div>
            <SectionLabel>연도별 실적</SectionLabel>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {years.map((year) => (
                <span key={year}>
                  <span className="text-muted-foreground">{year} </span>
                  <span className="font-bold">
                    {fmt(kpi.results[year])}
                    {kpi.results[year] !== null &&
                    kpi.results[year] !== undefined
                      ? (kpi.unit ?? '')
                      : ''}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function KpiView({
  kpis,
  taskByCode,
  years,
  year,
}: {
  kpis: SpKpi[];
  taskByCode: Map<string, SpTask>;
  years: number[];
  year: number;
}) {
  const kpiSort = useStrategicPlanStore((s) => s.kpiSort);
  const toggleKpiSort = useStrategicPlanStore((s) => s.toggleKpiSort);
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    if (!kpiSort.key) return kpis;
    return [...kpis].sort((a, b) => {
      const va = sortValue(a, kpiSort.key, year);
      const vb = sortValue(b, kpiSort.key, year);
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'string' && typeof vb === 'string') {
        return va.localeCompare(vb) * kpiSort.dir;
      }
      return ((va as number) - (vb as number)) * kpiSort.dir;
    });
  }, [kpis, kpiSort, year]);

  if (kpis.length === 0) {
    return <EmptyState>조건에 맞는 KPI가 없습니다.</EmptyState>;
  }

  const colSpan = 7;

  const sortHeader = (key: SpKpiSortKey, label: string, numeric = false) => (
    <th
      className={cn(
        'whitespace-nowrap px-3 py-2 font-bold',
        numeric ? 'text-right' : 'text-left',
      )}
    >
      <button
        type="button"
        onClick={() => toggleKpiSort(key)}
        className="inline-flex items-center gap-1 hover:underline"
      >
        {label}
        {kpiSort.key === key && (
          <span aria-hidden>{kpiSort.dir === 1 ? '▲' : '▼'}</span>
        )}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            {sortHeader('code', '코드')}
            <th className="px-3 py-2 text-left font-bold">
              지표명 · 실행과제 · 책임부서
            </th>
            <th className="px-3 py-2 text-left font-bold">단위</th>
            {sortHeader('baseline', '기준값', true)}
            {sortHeader('lastTarget', `${year} 목표`, true)}
            <th className="whitespace-nowrap px-3 py-2 text-right font-bold">
              {year} 실적
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-bold">
              달성률
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((kpi) => {
            const task = kpi.taskCode ? taskByCode.get(kpi.taskCode) : undefined;
            const accent = goalAccent(kpi.goalId);
            const open = openCodes.has(kpi.kpiCode);
            const target = kpi.targets[year] ?? null;
            const actual = kpi.results[year] ?? null;
            const rate = achievementRate(actual, target);
            return (
              <Fragment key={kpi.kpiCode}>
                <tr
                  className="cursor-pointer border-b hover:bg-accent/40"
                  onClick={() =>
                    setOpenCodes((prev) => {
                      const next = new Set(prev);
                      if (next.has(kpi.kpiCode)) next.delete(kpi.kpiCode);
                      else next.add(kpi.kpiCode);
                      return next;
                    })
                  }
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span
                        className={cn('h-2 w-2 rounded-full', accent.dot)}
                        aria-hidden
                      />
                      <span>{kpi.kpiCode}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block font-bold">{kpi.kpiName}</span>
                    {task && (
                      <span className="block text-muted-foreground">
                        {task.taskName} · {task.primaryDept}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {kpi.unit ?? ''}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(kpi.baseline)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(target)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(actual)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right tabular-nums',
                      rate !== null && rate >= 100 && 'font-bold text-emerald-700',
                    )}
                  >
                    {rate === null ? '–' : `${fmt1(rate)}%`}
                  </td>
                </tr>
                {open && (
                  <DetailRow
                    kpi={kpi}
                    task={task}
                    years={years}
                    colSpan={colSpan}
                  />
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
