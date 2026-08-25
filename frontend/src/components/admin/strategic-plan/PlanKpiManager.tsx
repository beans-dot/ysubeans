'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronRight, MoreHorizontal, Plus, Search } from 'lucide-react';
import { IR_WORK_SAVE_EVENT, notifyAutoSaved } from '@/components/admin/AutoSaveToast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/strategic-plan/ui';
import {
  createSpKpi,
  deleteSpKpi,
  fetchSpDepartments,
  saveSpKpiTarget,
  updateSpKpi,
} from '@/lib/strategic-plan/api';
import { apiMessage } from '@/lib/strategic-plan/apiError';
import type { SpDepartment, SpKpi, SpTask, SpTree } from '@/lib/strategic-plan/types';
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
  label,
}: {
  kpiCode: string;
  year: number;
  initial: number | null;
  label: string;
}) {
  const [value, setValue] = useState(initial === null ? '' : String(initial));

  const commit = async () => {
    const parsed = parseValue(value);
    if (parsed === undefined) return;
    if (parsed === initial || (parsed === null && initial === null)) return;
    try {
      await saveSpKpiTarget(kpiCode, year, parsed);
      notifyAutoSaved();
    } catch (e) {
      alert(apiMessage(e, '저장 실패'));
    }
  };

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      inputMode="decimal"
      aria-label={label}
      className="h-8 w-24 text-left tabular-nums"
    />
  );
}

function KpiMetaEditor({
  kpi,
  years,
  departments,
  reload,
}: {
  kpi: SpKpi;
  years: number[];
  departments: SpDepartment[];
  reload: () => Promise<void>;
}) {
  const [applyYear, setApplyYear] = useState(years[years.length - 1]);
  const [kpiName, setKpiName] = useState(kpi.kpiName);
  const [unit, setUnit] = useState(kpi.unit ?? '');
  const [baseline, setBaseline] = useState(
    kpi.baseline === null ? '' : String(kpi.baseline),
  );
  const [baselineRef, setBaselineRef] = useState(kpi.baselineRef ?? '');
  const [formula, setFormula] = useState(kpi.formula ?? '');
  const [primaryDept, setPrimaryDept] = useState(kpi.primaryDept ?? '');

  const saveMeta = async (patch: Record<string, unknown>) => {
    try {
      await updateSpKpi(kpi.kpiCode, { ...patch, year: applyYear } as Parameters<
        typeof updateSpKpi
      >[1]);
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, 'KPI 저장 실패'));
    }
  };

  return (
    <div className="grid gap-3 bg-muted/30 px-3 py-3 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label className="text-left">메타 정보 적용 학년도</Label>
        <NativeSelect
          value={String(applyYear)}
          onChange={(e) => setApplyYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}학년도부터
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label className="text-left" htmlFor={`kn-${kpi.kpiCode}`}>
          지표명
        </Label>
        <Input
          id={`kn-${kpi.kpiCode}`}
          value={kpiName}
          onChange={(e) => setKpiName(e.target.value)}
          onBlur={() => {
            if (kpiName.trim() === kpi.kpiName) return;
            void saveMeta({ kpiName: kpiName.trim() });
          }}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`ku-${kpi.kpiCode}`}>
          단위
        </Label>
        <Input
          id={`ku-${kpi.kpiCode}`}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          onBlur={() => {
            if (unit === (kpi.unit ?? '')) return;
            void saveMeta({ unit });
          }}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`kd-${kpi.kpiCode}`}>
          담당부서
        </Label>
        <NativeSelect
          id={`kd-${kpi.kpiCode}`}
          value={primaryDept}
          onChange={(e) => {
            setPrimaryDept(e.target.value);
            void saveMeta({ primaryDept: e.target.value });
          }}
        >
          <option value="">선택</option>
          {departments.map((d) => (
            <option key={d.deptId} value={d.deptName}>
              {d.deptName}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`kb-${kpi.kpiCode}`}>
          기준값
        </Label>
        <Input
          id={`kb-${kpi.kpiCode}`}
          value={baseline}
          onChange={(e) => setBaseline(e.target.value)}
          onBlur={() => {
            const parsed = parseValue(baseline);
            if (parsed === undefined) return;
            if (parsed === kpi.baseline || (parsed === null && kpi.baseline === null)) {
              return;
            }
            void saveMeta({ baseline: parsed });
          }}
          inputMode="decimal"
          className="h-9 text-left"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`kbr-${kpi.kpiCode}`}>
          기준연도 표기
        </Label>
        <Input
          id={`kbr-${kpi.kpiCode}`}
          value={baselineRef}
          onChange={(e) => setBaselineRef(e.target.value)}
          onBlur={() => {
            if (baselineRef === (kpi.baselineRef ?? '')) return;
            void saveMeta({ baselineRef });
          }}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label className="text-left" htmlFor={`kf-${kpi.kpiCode}`}>
          산출식
        </Label>
        <Textarea
          id={`kf-${kpi.kpiCode}`}
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          onBlur={() => {
            if (formula === (kpi.formula ?? '')) return;
            void saveMeta({ formula });
          }}
          className="min-h-[60px]"
        />
      </div>
      <div className="sm:col-span-2">
        <Label className="mb-2 block text-left">목표값 (2022~2027)</Label>
        <div className="flex flex-wrap gap-3">
          {years.map((y) => (
            <div key={y} className="grid gap-1">
              <span className="text-left text-xs text-muted-foreground">{y}</span>
              <ValueCell
                kpiCode={kpi.kpiCode}
                year={y}
                initial={kpi.targets[y] ?? null}
                label={`${kpi.kpiCode} ${y} 목표`}
              />
            </div>
          ))}
        </div>
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
  const years = tree.years;
  const defaultYear = years[years.length - 1] ?? new Date().getFullYear();
  const [query, setQuery] = useState('');
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [departments, setDepartments] = useState<SpDepartment[]>([]);
  const [busy, setBusy] = useState(false);
  const [createFor, setCreateFor] = useState<SpTask | null>(null);
  const [abolish, setAbolish] = useState<SpKpi | null>(null);
  const [year, setYear] = useState(defaultYear);
  const [kpiCode, setKpiCode] = useState('');
  const [kpiName, setKpiName] = useState('');
  const [unit, setUnit] = useState('');
  const [dept, setDept] = useState('');

  useEffect(() => {
    fetchSpDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    const onSave = () => {
      void reload().then(() => notifyAutoSaved());
    };
    window.addEventListener(IR_WORK_SAVE_EVENT, onSave);
    return () => window.removeEventListener(IR_WORK_SAVE_EVENT, onSave);
  }, [reload]);

  const kpiByCode = useMemo(
    () => new Map(tree.kpis.map((k) => [k.kpiCode, k])),
    [tree.kpis],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tree.tasks
      .map((task) => {
        const kpis = task.kpiCodes
          .map((code) => kpiByCode.get(code))
          .filter((k): k is SpKpi => Boolean(k))
          .filter((kpi) => {
            if (!q) return true;
            return [kpi.kpiCode, kpi.kpiName, task.taskName, kpi.primaryDept ?? '']
              .join(' ')
              .toLowerCase()
              .includes(q);
          });
        return { task, kpis };
      })
      .filter((g) => g.kpis.length > 0 || !q);
  }, [tree.tasks, kpiByCode, query]);

  const submitCreate = async () => {
    if (!createFor) return;
    setBusy(true);
    try {
      await createSpKpi({
        kpiCode: kpiCode.trim(),
        kpiName: kpiName.trim(),
        taskCode: createFor.taskCode,
        unit: unit.trim() || undefined,
        primaryDept: dept.trim() || undefined,
        year,
      });
      setCreateFor(null);
      await reload();
      notifyAutoSaved();
    } catch (e) {
      alert(apiMessage(e, 'KPI 신설 실패'));
    } finally {
      setBusy(false);
    }
  };

  const submitAbolish = async () => {
    if (!abolish) return;
    setBusy(true);
    try {
      await deleteSpKpi(abolish.kpiCode, year);
      setAbolish(null);
      await reload();
      notifyAutoSaved();
    } catch (e) {
      alert(apiMessage(e, 'KPI 폐지 실패'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>KPI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          실행과제 단위로 묶입니다. 지표를 누르면 기준값과 2022~2027 목표를 관리합니다.
          칸을 벗어나면 자동 저장됩니다.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="지표·과제·부서 검색"
              className="h-9 pl-8"
            />
          </div>
        </div>

        <div className="space-y-4">
          {groups.map(({ task, kpis }) => (
            <section key={task.taskCode} className="rounded-md border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
                <h3 className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-bold">
                  <Badge variant="code">{task.displayCode ?? task.taskCode}</Badge>
                  <span>{task.taskName}</span>
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    setCreateFor(task);
                    setYear(defaultYear);
                    setKpiCode(`${task.taskCode}a`);
                    setKpiName('');
                    setUnit('');
                    setDept(task.primaryDept ?? '');
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> KPI 신설
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs">
                    <tr>
                      <th className="px-2 py-2 text-left font-bold">코드</th>
                      <th className="px-2 py-2 text-left font-bold">지표명</th>
                      <th className="px-2 py-2 text-left font-bold">담당부서</th>
                      <th className="px-2 py-2 text-left font-bold">기준값</th>
                      <th className="px-2 py-2 text-left font-bold"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.map((kpi) => {
                      const open = openCode === kpi.kpiCode;
                      return (
                        <Fragment key={kpi.kpiCode}>
                          <tr className="border-b align-top">
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                aria-expanded={open}
                                onClick={() =>
                                  setOpenCode(open ? null : kpi.kpiCode)
                                }
                                className="flex items-center gap-1.5 text-left"
                              >
                                <ChevronRight
                                  className={cn(
                                    'h-3.5 w-3.5 transition-transform',
                                    open && 'rotate-90',
                                  )}
                                />
                                <Badge variant="code">
                                  {kpi.displayCode ?? kpi.kpiCode}
                                </Badge>
                              </button>
                            </td>
                            <td className="px-2 py-1.5 text-left">
                              {kpi.kpiName}
                              {kpi.unit && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({kpi.unit})
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-left text-xs text-muted-foreground">
                              {kpi.primaryDept ?? task.primaryDept ?? '–'}
                            </td>
                            <td className="px-2 py-1.5 text-left tabular-nums">
                              {kpi.baseline ?? '–'}
                            </td>
                            <td className="px-2 py-1.5 text-left">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() => {
                                  setAbolish(kpi);
                                  setYear(defaultYear);
                                }}
                                title="폐지"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                          {open && (
                            <tr className="border-b">
                              <td colSpan={5} className="p-0">
                                <KpiMetaEditor
                                  kpi={kpi}
                                  years={years}
                                  departments={departments}
                                  reload={reload}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {kpis.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-4 text-center text-sm text-muted-foreground"
                        >
                          이 실행과제에 KPI가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!createFor} onOpenChange={(v) => !v && setCreateFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>KPI 신설</DialogTitle>
            <DialogDescription>
              코드는 A11a처럼 실행과제 코드+소문자입니다. 적용 학년도부터 조회됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-left">코드</Label>
              <Input
                value={kpiCode}
                onChange={(e) => setKpiCode(e.target.value)}
                className="h-9 font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-left">지표명</Label>
              <Input
                value={kpiName}
                onChange={(e) => setKpiName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-left">단위</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-left">담당부서</Label>
              <NativeSelect value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">선택</option>
                {departments.map((d) => (
                  <option key={d.deptId} value={d.deptName}>
                    {d.deptName}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-left">적용 학년도</Label>
              <NativeSelect
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}학년도부터
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFor(null)}>
              취소
            </Button>
            <Button disabled={busy} onClick={() => void submitCreate()}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!abolish} onOpenChange={(v) => !v && setAbolish(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>KPI 폐지</DialogTitle>
            <DialogDescription>
              폐지 학년도 이전 조회는 기존 KPI를 유지합니다.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {abolish?.displayCode ?? abolish?.kpiCode} {abolish?.kpiName}
          </p>
          <div className="grid gap-1.5">
            <Label className="text-left">폐지 학년도</Label>
            <NativeSelect
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}학년도부터
                </option>
              ))}
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbolish(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void submitAbolish()}
            >
              폐지
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
