'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronRight, Save, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/strategic-plan/ui';
import {
  saveSpKpiResult,
  saveSpKpiTarget,
  updateSpKpi,
} from '@/lib/strategic-plan/api';
import { apiMessage } from '@/lib/strategic-plan/apiError';
import type { SpKpi, SpTree } from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';

function parseValue(input: string): number | null | undefined {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function ValueCell({
  kpiCode,
  year,
  initial,
  kind,
}: {
  kpiCode: string;
  year: number;
  initial: number | null;
  kind: 'target' | 'result';
}) {
  const [value, setValue] = useState(initial === null ? '' : String(initial));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );

  const commit = async () => {
    const parsed = parseValue(value);
    if (parsed === undefined) {
      setState('error');
      return;
    }
    if (parsed === initial || (parsed === null && initial === null)) {
      setState('idle');
      return;
    }
    setState('saving');
    try {
      if (kind === 'target') await saveSpKpiTarget(kpiCode, year, parsed);
      else await saveSpKpiResult(kpiCode, year, parsed);
      setState('saved');
    } catch (e) {
      setState('error');
      alert(apiMessage(e, '저장 실패'));
    }
  };

  return (
    <Input
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        setState('idle');
      }}
      onBlur={() => void commit()}
      inputMode="decimal"
      aria-label={`${kpiCode} ${year} ${kind === 'target' ? '목표' : '실적'}`}
      className={cn(
        'h-8 w-24 text-right tabular-nums',
        state === 'saved' && 'border-emerald-500',
        state === 'error' && 'border-destructive',
        state === 'saving' && 'opacity-60',
      )}
    />
  );
}

function KpiDetailEditor({
  kpi,
  reload,
}: {
  kpi: SpKpi;
  reload: () => Promise<void>;
}) {
  const [kpiName, setKpiName] = useState(kpi.kpiName);
  const [unit, setUnit] = useState(kpi.unit ?? '');
  const [baseline, setBaseline] = useState(
    kpi.baseline === null ? '' : String(kpi.baseline),
  );
  const [baselineRef, setBaselineRef] = useState(kpi.baselineRef ?? '');
  const [formula, setFormula] = useState(kpi.formula ?? '');
  const [source, setSource] = useState(kpi.source ?? '');
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    const parsed = parseValue(baseline);
    if (parsed === undefined) {
      alert('기준값은 숫자만 입력할 수 있습니다.');
      return;
    }
    setBusy(true);
    try {
      await updateSpKpi(kpi.kpiCode, {
        kpiName: kpiName.trim(),
        unit,
        baseline: parsed,
        baselineRef,
        formula,
        source,
      });
      await reload();
    } catch (e) {
      alert(apiMessage(e, 'KPI 저장 실패'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 bg-muted/30 px-3 py-3 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={`kn-${kpi.kpiCode}`}>지표명</Label>
        <Input
          id={`kn-${kpi.kpiCode}`}
          value={kpiName}
          onChange={(e) => setKpiName(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`ku-${kpi.kpiCode}`}>단위</Label>
        <Input
          id={`ku-${kpi.kpiCode}`}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`kb-${kpi.kpiCode}`}>기준값</Label>
        <Input
          id={`kb-${kpi.kpiCode}`}
          value={baseline}
          onChange={(e) => setBaseline(e.target.value)}
          inputMode="decimal"
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={`kbr-${kpi.kpiCode}`}>기준연도 표기</Label>
        <Input
          id={`kbr-${kpi.kpiCode}`}
          value={baselineRef}
          onChange={(e) => setBaselineRef(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={`kf-${kpi.kpiCode}`}>산출식</Label>
        <Textarea
          id={`kf-${kpi.kpiCode}`}
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          className="min-h-[60px]"
        />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={`ks-${kpi.kpiCode}`}>자료원</Label>
        <Textarea
          id={`ks-${kpi.kpiCode}`}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="min-h-[60px]"
        />
      </div>
      <div className="sm:col-span-2">
        <Button size="sm" disabled={busy} onClick={() => void handleSave()}>
          <Save className="mr-1 h-4 w-4" /> KPI 정보 저장
        </Button>
      </div>
    </div>
  );
}

export function PlanKpiManager({
  tree,
  reload,
}: {
  tree: SpTree;
  reload: () => Promise<void>;
}) {
  const [year, setYear] = useState(
    tree.years[tree.years.length - 1] ?? new Date().getFullYear(),
  );
  const [goalId, setGoalId] = useState('');
  const [query, setQuery] = useState('');
  const [openCode, setOpenCode] = useState<string | null>(null);

  const taskByCode = useMemo(
    () => new Map(tree.tasks.map((t) => [t.taskCode, t])),
    [tree.tasks],
  );

  const kpis = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tree.kpis.filter((kpi) => {
      if (goalId && kpi.goalId !== goalId) return false;
      if (!q) return true;
      const task = kpi.taskCode ? taskByCode.get(kpi.taskCode) : undefined;
      return [kpi.kpiCode, kpi.kpiName, task?.taskName ?? '', task?.primaryDept ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [tree.kpis, goalId, query, taskByCode]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>KPI 목표 · 실적</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          칸을 벗어나면 바로 저장됩니다. 빈 칸으로 두면 값이 지워집니다.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="연도"
          >
            {tree.years.map((y) => (
              <option key={y} value={String(y)}>
                {y}학년도
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            aria-label="발전전략"
          >
            <option value="">전체 발전전략</option>
            {tree.goals.map((g) => (
              <option key={g.goalId} value={g.goalId}>
                {g.goalId}. {g.goalName}
              </option>
            ))}
          </NativeSelect>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="지표·과제·부서 검색"
              className="h-9 pl-8"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {kpis.length}개 표시
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b text-xs">
              <tr>
                <th className="px-2 py-2 text-left font-bold">코드</th>
                <th className="px-2 py-2 text-left font-bold">지표명</th>
                <th className="px-2 py-2 text-left font-bold">실행과제</th>
                <th className="px-2 py-2 text-right font-bold">기준값</th>
                <th className="px-2 py-2 text-right font-bold">{year} 목표</th>
                <th className="px-2 py-2 text-right font-bold">{year} 실적</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi) => {
                const task = kpi.taskCode ? taskByCode.get(kpi.taskCode) : null;
                const open = openCode === kpi.kpiCode;
                return (
                  <Fragment key={kpi.kpiCode}>
                    <tr className="border-b align-top">
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setOpenCode(open ? null : kpi.kpiCode)}
                          className="flex items-center gap-1 font-mono text-xs hover:underline"
                        >
                          <ChevronRight
                            className={cn(
                              'h-3.5 w-3.5 transition-transform',
                              open && 'rotate-90',
                            )}
                          />
                          {kpi.kpiCode}
                        </button>
                      </td>
                      <td className="px-2 py-1.5">
                        {kpi.kpiName}
                        {kpi.unit && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({kpi.unit})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">
                        {task ? (
                          <span className="flex flex-wrap items-center gap-1">
                            {task.taskName}
                            {task.primaryDept && (
                              <Badge variant="outline">{task.primaryDept}</Badge>
                            )}
                          </span>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {kpi.baseline ?? '–'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <ValueCell
                          key={`t-${kpi.kpiCode}-${year}`}
                          kpiCode={kpi.kpiCode}
                          year={year}
                          initial={kpi.targets[year] ?? null}
                          kind="target"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <ValueCell
                          key={`r-${kpi.kpiCode}-${year}`}
                          kpiCode={kpi.kpiCode}
                          year={year}
                          initial={kpi.results[year] ?? null}
                          kind="result"
                        />
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b">
                        <td colSpan={6} className="p-0">
                          <KpiDetailEditor kpi={kpi} reload={reload} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {kpis.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              조건에 맞는 KPI가 없습니다.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
