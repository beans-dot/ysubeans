'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fmt1, fmtWon, parseAmount } from '@/lib/strategic-plan/format';
import { goalAccent } from '@/lib/strategic-plan/goalAccent';
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
import {
  budgetKey,
  useStrategicPlanStore,
} from '@/store/useStrategicPlanStore';
import { EmptyState } from './ui';

const EMPTY_ROW = { budget: '', settlement: '' };

function taskRows(
  budgets: SpBudgetDraft,
  taskCode: string,
  fundSources: SpFundSource[],
) {
  return fundSources.map(
    (fund) => budgets[budgetKey(taskCode, fund.fundSourceId)] ?? EMPTY_ROW,
  );
}

function sum(values: Array<number | null>) {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
}

function AmountInput({
  taskCode,
  fundSourceId,
  kind,
  value,
  label,
  readOnly,
}: {
  taskCode: string;
  fundSourceId: number;
  kind: 'budget' | 'settlement';
  value: string;
  label: string;
  readOnly?: boolean;
}) {
  const setBudgetField = useStrategicPlanStore((s) => s.setBudgetField);
  const parsed = parseAmount(value);
  if (readOnly) {
    return (
      <span className="tabular-nums">{fmtWon(parsed)}</span>
    );
  }
  const invalid = value.trim() !== '' && parsed === null;
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={value}
      placeholder="0"
      aria-label={label}
      aria-invalid={invalid}
      onChange={(e) =>
        setBudgetField(taskCode, fundSourceId, kind, e.target.value)
      }
      className={cn(
        'h-8 w-32 text-right tabular-nums',
        invalid && 'border-destructive',
      )}
    />
  );
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
  const accent = goalAccent(task.goalId);
  const rows = taskRows(budgets, task.taskCode, fundSources);
  const status = budgetStatus(rows);
  const budgetTotal = sum(rows.map((r) => parseAmount(r.budget)));
  const settlementTotal = sum(rows.map((r) => parseAmount(r.settlement)));
  const executionRate =
    budgetTotal !== null && budgetTotal > 0 && settlementTotal !== null
      ? (settlementTotal / budgetTotal) * 100
      : null;

  return (
    <Card className={cn('border-l-4', accent.border)}>
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
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{task.taskName}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {task.primaryDept && (
              <Badge variant="outline" className={accent.badge}>
                {task.primaryDept}
              </Badge>
            )}
            <Badge variant="outline">
              {task.taskCode}
            </Badge>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block tabular-nums">
            예산 {fmtWon(budgetTotal)} / 결산 {fmtWon(settlementTotal)}
          </span>
          <Badge
            variant="outline"
            className={cn('mt-1', SP_STATUS_CLASS[status])}
          >
            {SP_STATUS_LABEL[status]}
          </Badge>
        </span>
      </button>

      {open && (
        <CardContent className="border-t pt-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-2 py-1.5 text-left font-bold">재원</th>
                  <th className="px-2 py-1.5 text-right font-bold">
                    {year} 예산(원)
                  </th>
                  <th className="px-2 py-1.5 text-right font-bold">
                    {year} 결산(원)
                  </th>
                  <th className="px-2 py-1.5 text-right font-bold">집행률</th>
                </tr>
              </thead>
              <tbody>
                {fundSources.map((fund, index) => {
                  const row = rows[index];
                  const b = parseAmount(row.budget);
                  const s = parseAmount(row.settlement);
                  const rate = b !== null && b > 0 && s !== null ? (s / b) * 100 : null;
                  return (
                    <tr key={fund.fundSourceId} className="border-b last:border-b-0">
                      <td className="px-2 py-1.5">{fund.fundSourceName}</td>
                      <td className="px-2 py-1.5 text-right">
                        <AmountInput
                          taskCode={task.taskCode}
                          fundSourceId={fund.fundSourceId}
                          kind="budget"
                          value={row.budget}
                          label={`${task.taskName} ${fund.fundSourceName} ${year} 예산`}
                          readOnly={readOnly}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <AmountInput
                          taskCode={task.taskCode}
                          fundSourceId={fund.fundSourceId}
                          kind="settlement"
                          value={row.settlement}
                          label={`${task.taskName} ${fund.fundSourceName} ${year} 결산`}
                          readOnly={readOnly}
                        />
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
                  <td className="px-2 py-1.5">합계</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {fmtWon(budgetTotal)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {fmtWon(settlementTotal)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {executionRate === null ? '–' : `${fmt1(executionRate)}%`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function BudgetView({
  tasks,
  fundSources,
  readOnly = false,
}: {
  tasks: SpTask[];
  fundSources: SpFundSource[];
  readOnly?: boolean;
}) {
  const year = useStrategicPlanStore((s) => s.year);
  const budgets = useStrategicPlanStore((s) => s.budgets);

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
    const rows = taskRows(budgets, task.taskCode, fundSources);
    const status = budgetStatus(rows);
    if (status === 'done') done += 1;
    else if (status === 'part') part += 1;
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
        <span className="text-muted-foreground">
          {year}학년도
          {readOnly ? ' · 조회 전용' : ' · 입력하면 자동 저장됩니다.'}
        </span>
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-2 text-sm font-bold">
            재원별 합계 (단위 원)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
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
                    <tr key={fund.fundSourceId} className="border-b last:border-b-0">
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

      {tasks.length === 0 ? (
        <EmptyState>조건에 맞는 실행과제가 없습니다.</EmptyState>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <BudgetTaskCard
              key={task.taskCode}
              task={task}
              fundSources={fundSources}
              budgets={budgets}
              year={year}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
