'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { notifyAutoSaved } from '@/components/admin/AutoSaveToast';
import { SpCodeBadge } from '@/components/strategic-plan/SpCodeBadge';
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

function kpiLetter(kpi: SpKpi) {
  const display = kpi.displayCode ?? kpi.kpiCode;
  const m = /([a-z])$/.exec(display);
  return m?.[1] ?? kpi.suffix ?? 'a';
}

function kpiPrefix(kpi: SpKpi) {
  return kpi.taskCode || (kpi.displayCode ?? kpi.kpiCode).replace(/[a-z]$/, '');
}

function nextLetter(task: SpTask, kpiByCode: Map<string, SpKpi>) {
  const used = new Set(
    task.kpiCodes.map((code) => {
      const kpi = kpiByCode.get(code);
      return kpi ? kpiLetter(kpi) : code.slice(-1);
    }),
  );
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
    if (!used.has(ch)) return ch;
  }
  return 'a';
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
  const [letter, setLetter] = useState(kpiLetter(kpi));
  const [busy, setBusy] = useState(false);
  const prefix = kpiPrefix(kpi);

  const saveMeta = async () => {
    const nextLetter = letter.trim().toLowerCase();
    if (nextLetter && !/^[a-z]$/.test(nextLetter)) {
      alert('KPI 코드 소문자를 한 글자 입력해 주세요.');
      return;
    }
    const parsed = parseValue(baseline);
    if (parsed === undefined) {
      alert('기준값을 숫자로 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await updateSpKpi(kpi.kpiCode, {
        kpiName: kpiName.trim(),
        unit,
        primaryDept,
        baseline: parsed,
        baselineRef,
        formula,
        year: applyYear,
        ...( /^[a-z]$/.test(nextLetter) ? { suffix: nextLetter } : {}),
      });
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, 'KPI 저장 실패'));
    } finally {
      setBusy(false);
    }
  };

  const abolish = async () => {
    const ok = window.confirm(
      `${applyYear}학년도부터 ${kpi.displayCode ?? kpi.kpiCode}를 폐지할까요? 이후 코드는 소문자가 앞으로 당겨집니다.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteSpKpi(kpi.kpiCode, applyYear);
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, 'KPI 폐지 실패'));
    } finally {
      setBusy(false);
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
        <p className="text-xs text-muted-foreground">
          선택한 학년도 이전 조회는 기존 내용·코드를 유지합니다.
        </p>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label className="text-left" htmlFor={`kc-${kpi.kpiCode}`}>
          코드 (앞자리 고정, 소문자만 변경)
        </Label>
        <div className="flex items-center gap-1">
          <Input value={prefix} readOnly className="h-9 w-24" />
          <Input
            id={`kc-${kpi.kpiCode}`}
            value={letter}
            maxLength={1}
            onChange={(e) =>
              setLetter(e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase())
            }
            className="h-9 w-12 text-center font-bold"
            aria-label="KPI 소문자 코드"
          />
        </div>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label className="text-left" htmlFor={`kn-${kpi.kpiCode}`}>
          지표명
        </Label>
        <Input
          id={`kn-${kpi.kpiCode}`}
          value={kpiName}
          onChange={(e) => setKpiName(e.target.value)}
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
          onChange={(e) => setPrimaryDept(e.target.value)}
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
      <div className="flex justify-end gap-1 sm:col-span-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          disabled={busy}
          onClick={() => void saveMeta()}
        >
          수정
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => void abolish()}
        >
          폐지
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
  const years = tree.years;
  const defaultYear = years[years.length - 1] ?? new Date().getFullYear();
  const [query, setQuery] = useState('');
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [departments, setDepartments] = useState<SpDepartment[]>([]);
  const [busy, setBusy] = useState(false);
  const [createFor, setCreateFor] = useState<SpTask | null>(null);
  const [year, setYear] = useState(defaultYear);
  const [kpiLetterInput, setKpiLetterInput] = useState('a');
  const [kpiName, setKpiName] = useState('');
  const [unit, setUnit] = useState('');
  const [dept, setDept] = useState('');

  useEffect(() => {
    fetchSpDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

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
            return [kpi.kpiCode, kpi.displayCode ?? '', kpi.kpiName, task.taskName, kpi.primaryDept ?? '']
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
    const letter = kpiLetterInput.trim().toLowerCase();
    if (!/^[a-z]$/.test(letter)) {
      alert('KPI 코드 소문자를 한 글자 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await createSpKpi({
        kpiCode: `${createFor.taskCode}${letter}`,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>KPI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          실행과제 단위로 묶입니다. 코드 옆 &#39;&gt;&#39;를 눌러 내용을 고친 뒤
          수정을 누르면 저장됩니다. 연도별 목표값은 칸을 벗어나면 저장됩니다.
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
                  <SpCodeBadge level="task">{task.displayCode ?? task.taskCode}</SpCodeBadge>
                  <span>{task.taskName}</span>
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    setCreateFor(task);
                    setYear(defaultYear);
                    setKpiLetterInput(nextLetter(task, kpiByCode));
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
                                <SpCodeBadge level="kpi">
                                  {kpi.displayCode ?? kpi.kpiCode}
                                </SpCodeBadge>
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
                          </tr>
                          {open && (
                            <tr className="border-b">
                              <td colSpan={4} className="p-0">
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
                          colSpan={4}
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
              <Label className="text-left">코드 (앞자리 고정)</Label>
              <div className="flex items-center gap-1">
                <Input value={createFor?.taskCode ?? ''} readOnly className="h-9 w-24" />
                <Input
                  value={kpiLetterInput}
                  maxLength={1}
                  onChange={(e) =>
                    setKpiLetterInput(
                      e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase(),
                    )
                  }
                  className="h-9 w-12 text-center font-bold"
                  aria-label="KPI 소문자 코드"
                />
              </div>
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
    </Card>
  );
}
