'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Copy, FileDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { taskBudgetUnits } from '@/lib/strategic-plan/evalDraft';
import {
  exportStamp,
  settlementExportRows,
  writeXlsxAndLog,
} from '@/lib/strategic-plan/exportXlsx';
import { fmt1, fmtWon, parseAmount } from '@/lib/strategic-plan/format';
import {
  SP_STATUS_CLASS,
  SP_STATUS_LABEL,
  budgetStatus,
} from '@/lib/strategic-plan/status';
import type {
  SpBudgetDraft,
  SpFundSource,
  SpTask,
} from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import { useStrategicPlanStore } from '@/store/useStrategicPlanStore';
import {
  BudgetAmountTable,
  TaskBudgetGrandTotal,
  sumAmounts,
  unitBudgetRows,
} from './BudgetAmountTable';
import { TaskHeading } from './TaskHeading';
import { WriteCompleteControls } from './WriteCompleteControls';
import { EmptyState } from './ui';

type ExportScope = 'selected' | 'all';

function taskTotals(
  budgets: SpBudgetDraft,
  task: SpTask,
  fundSources: SpFundSource[],
) {
  const units = taskBudgetUnits(task);
  const allRows = units.flatMap((unit) =>
    unitBudgetRows(budgets, task.taskCode, unit.code, fundSources),
  );
  return {
    units,
    allRows,
    budgetTotal: sumAmounts(allRows.map((r) => parseAmount(r.budget))),
    settlementTotal: sumAmounts(allRows.map((r) => parseAmount(r.settlement))),
    status: budgetStatus(allRows),
  };
}

function BudgetTaskCard({
  task,
  fundSources,
  budgets,
  year,
  readOnly,
}: {
  task: SpTask;
  fundSources: SpFundSource[];
  budgets: SpBudgetDraft;
  year: number;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const setWriteLock = useStrategicPlanStore((s) => s.setWriteLock);
  const completed = useStrategicPlanStore(
    (s) => s.writeLocks[task.taskCode]?.budgetCompleted ?? false,
  );
  const { units, budgetTotal, settlementTotal, status } = taskTotals(
    budgets,
    task,
    fundSources,
  );
  const locked = readOnly || completed;
  const badgeStatus = completed ? 'done' : status;
  const badgeLabel = completed ? '작성완료' : SP_STATUS_LABEL[status];

  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 p-4 text-left hover:bg-accent/40"
      >
        <ChevronRight
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90',
          )}
        />
        <TaskHeading task={task} />
        <span className="shrink-0 text-right">
          <span className="block text-muted-foreground">실행과제 총계</span>
          <span className="block tabular-nums">
            예산 {fmtWon(budgetTotal)} / 결산 {fmtWon(settlementTotal)}
          </span>
          <Badge
            variant="outline"
            className={cn('mt-1', SP_STATUS_CLASS[badgeStatus])}
          >
            {badgeLabel}
          </Badge>
        </span>
      </button>

      {open && (
        <CardContent className="space-y-6 border-t pt-4">
          {units.map((unit) => (
            <BudgetAmountTable
              key={unit.code}
              taskCode={task.taskCode}
              unitCode={unit.code}
              unitName={unit.name}
              displayCode={unit.displayCode}
              fundSources={fundSources}
              year={year}
              readOnly={locked}
            />
          ))}
          <TaskBudgetGrandTotal
            taskCode={task.taskCode}
            units={units}
            fundSources={fundSources}
            year={year}
            budgetTotal={budgetTotal}
            settlementTotal={settlementTotal}
            completeControls={
              !readOnly ? (
                <WriteCompleteControls
                  className="mt-3"
                  completed={completed}
                  onComplete={() =>
                    void setWriteLock(task.taskCode, 'budget', true)
                  }
                  onEdit={() =>
                    void setWriteLock(task.taskCode, 'budget', false)
                  }
                />
              ) : undefined
            }
          />
        </CardContent>
      )}
    </Card>
  );
}

export function BudgetView({
  tasks,
  fundSources,
  readOnly = false,
  exportable = false,
}: {
  tasks: SpTask[];
  fundSources: SpFundSource[];
  readOnly?: boolean;
  exportable?: boolean;
}) {
  const year = useStrategicPlanStore((s) => s.year);
  const budgets = useStrategicPlanStore((s) => s.budgets);
  const copyPreviousYearBudgets = useStrategicPlanStore(
    (s) => s.copyPreviousYearBudgets,
  );
  const [copying, setCopying] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scope, setScope] = useState<ExportScope>('all');
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setCopyNotice(null);
    setSelected(new Set());
    setExportError(null);
  }, [year]);

  const copyLastYear = async () => {
    setCopying(true);
    setCopyNotice(null);
    try {
      const notice = await copyPreviousYearBudgets();
      if (notice) setCopyNotice(notice);
    } finally {
      setCopying(false);
    }
  };

  const allSelected = tasks.length > 0 && selected.size === tasks.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleTask = (taskCode: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(taskCode);
      else next.delete(taskCode);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(tasks.map((t) => t.taskCode)) : new Set());
  };

  const openExportDialog = () => {
    setExportError(null);
    setScope(selected.size > 0 ? 'selected' : 'all');
    setDialogOpen(true);
  };

  const downloadExcel = () => {
    if (scope === 'selected' && selected.size === 0) {
      setExportError('출력할 실행과제를 선택해 주세요.');
      return;
    }
    const targets =
      scope === 'all'
        ? tasks
        : tasks.filter((task) => selected.has(task.taskCode));
    if (targets.length === 0) {
      setExportError('출력할 실행과제가 없습니다.');
      return;
    }
    const stamp = exportStamp();
    const suffix = scope === 'all' ? '전체' : `선택${targets.length}건`;
    const filename = `결산조회_${year}_${suffix}_${stamp}.xlsx`;
    writeXlsxAndLog({
      rows: settlementExportRows(targets, fundSources, budgets, year),
      sheetName: '결산조회',
      filename,
      source: 'settlement-xlsx',
      summary: `${year}학년도 결산 조회 · ${suffix}`,
    });
    setDialogOpen(false);
  };

  if (fundSources.length === 0) {
    return (
      <EmptyState>
        활성 재원 유형이 없습니다. 관리자 화면에서 재원을 먼저 추가해 주세요.
      </EmptyState>
    );
  }

  let done = 0;
  let part = 0;
  const fundTotals = fundSources.map(() => ({
    budget: 0,
    settlement: 0,
    hasBudget: false,
    hasSettlement: false,
  }));

  for (const task of tasks) {
    const { units, status } = taskTotals(budgets, task, fundSources);
    if (status === 'done') done += 1;
    else if (status === 'part') part += 1;
    for (const unit of units) {
      const rows = unitBudgetRows(budgets, task.taskCode, unit.code, fundSources);
      rows.forEach((row, index) => {
        const b = parseAmount(row.budget);
        const s = parseAmount(row.settlement);
        if (b !== null) {
          fundTotals[index].budget += b;
          fundTotals[index].hasBudget = true;
        }
        if (s !== null) {
          fundTotals[index].settlement += s;
          fundTotals[index].hasSettlement = true;
        }
      });
    }
  }
  const none = tasks.length - done - part;
  const grandBudget = fundTotals.reduce((a, t) => a + t.budget, 0);
  const grandSettlement = fundTotals.reduce((a, t) => a + t.settlement, 0);
  const grandRate =
    grandBudget > 0 ? (grandSettlement / grandBudget) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            실행과제 <b>{tasks.length}</b>건
          </span>
          <span className="text-emerald-700">
            {SP_STATUS_LABEL.done} <b>{done}</b>건
          </span>
          <span className="text-amber-700">
            {SP_STATUS_LABEL.part} <b>{part}</b>건
          </span>
          <span className="text-muted-foreground">
            미입력 <b>{none}</b>건
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={copying}
              onClick={() => void copyLastYear()}
            >
              <Copy className="h-4 w-4" />
              {copying ? '복사 중…' : '작년 예산 복사하기'}
            </Button>
          )}
          <span className="text-muted-foreground">
            {year}학년도
            {readOnly ? ' · 조회 전용' : ' · 입력하면 자동 저장됩니다.'}
          </span>
        </div>
      </div>

      {copyNotice && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {copyNotice}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-2 text-sm font-bold">재원별 합계 (단위 원)</h3>
          <div>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-2 py-1.5 text-left font-bold">재원</th>
                  <th className="px-2 py-1.5 text-right font-bold">예산</th>
                  <th className="px-2 py-1.5 text-right font-bold">결산</th>
                  <th className="px-2 py-1.5 text-right font-bold">집행률</th>
                </tr>
              </thead>
              <tbody>
                {fundSources.map((fund, index) => {
                  const total = fundTotals[index];
                  const rate =
                    total.budget > 0
                      ? (total.settlement / total.budget) * 100
                      : null;
                  return (
                    <tr
                      key={fund.fundSourceId}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-2 py-1.5">{fund.fundSourceName}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {total.hasBudget ? fmtWon(total.budget) : '–'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {total.hasSettlement ? fmtWon(total.settlement) : '–'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {rate === null ? '–' : `${fmt1(rate)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/40 font-bold">
                  <td className="px-2 py-1.5">총계</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {grandBudget > 0 ? fmtWon(grandBudget) : '–'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {grandSettlement > 0 ? fmtWon(grandSettlement) : '–'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {grandRate === null ? '–' : `${fmt1(grandRate)}%`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {exportable && tasks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={(value) => toggleAll(value === true)}
              aria-label="실행과제 전체 선택"
            />
            전체 선택
            <span className="text-muted-foreground">
              ({selected.size}/{tasks.length})
            </span>
          </label>
          <Button size="sm" onClick={openExportDialog}>
            <FileDown className="h-4 w-4" />
            엑셀 다운로드
          </Button>
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState>조건에 맞는 실행과제가 없습니다.</EmptyState>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) =>
            exportable ? (
              <div key={task.taskCode} className="flex items-start gap-3">
                <div className="pt-5">
                  <Checkbox
                    checked={selected.has(task.taskCode)}
                    onCheckedChange={(value) =>
                      toggleTask(task.taskCode, value === true)
                    }
                    aria-label={`${task.taskCode} ${task.taskName} 선택`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <BudgetTaskCard
                    task={task}
                    fundSources={fundSources}
                    budgets={budgets}
                    year={year}
                    readOnly={readOnly}
                  />
                </div>
              </div>
            ) : (
              <BudgetTaskCard
                key={task.taskCode}
                task={task}
                fundSources={fundSources}
                budgets={budgets}
                year={year}
                readOnly={readOnly}
              />
            ),
          )}
        </div>
      )}

      {exportable && (
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>엑셀 다운로드</DialogTitle>
              <DialogDescription>
                선택한 실행과제 또는 전체를 한 시트로 받습니다. 실행과제별
                소계가 포함됩니다.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3',
                  scope === 'selected' && 'border-primary bg-primary/5',
                  selected.size === 0 && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="radio"
                  name="settlement-xlsx-scope"
                  className="mt-1"
                  checked={scope === 'selected'}
                  disabled={selected.size === 0}
                  onChange={() => setScope('selected')}
                />
                <span>
                  <span className="font-bold">선택한 실행과제만</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {selected.size > 0
                      ? `${selected.size}건`
                      : '실행과제를 먼저 선택해 주세요.'}
                  </span>
                </span>
              </label>

              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3',
                  scope === 'all' && 'border-primary bg-primary/5',
                )}
              >
                <input
                  type="radio"
                  name="settlement-xlsx-scope"
                  className="mt-1"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                />
                <span>
                  <span className="font-bold">전체 출력</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    실행과제 {tasks.length}건
                  </span>
                </span>
              </label>
            </div>

            {exportError && (
              <p className="text-sm text-destructive">{exportError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                disabled={scope === 'selected' && selected.size === 0}
                onClick={downloadExcel}
              >
                <FileDown className="h-4 w-4" />
                다운로드
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
