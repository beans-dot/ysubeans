'use client';

import { Input } from '@/components/ui/input';
import { fmt1, fmtWon, parseAmount } from '@/lib/strategic-plan/format';
import type { SpBudgetDraft, SpFundSource } from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import {
  budgetKey,
  useStrategicPlanStore,
} from '@/store/useStrategicPlanStore';

const EMPTY_ROW = { budget: '', settlement: '' };

export function unitBudgetRows(
  budgets: SpBudgetDraft,
  taskCode: string,
  unitCode: string,
  fundSources: SpFundSource[],
) {
  return fundSources.map(
    (fund) =>
      budgets[budgetKey(taskCode, unitCode, fund.fundSourceId)] ?? EMPTY_ROW,
  );
}

export function sumAmounts(values: Array<number | null>) {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
}

function AmountInput({
  taskCode,
  unitCode,
  fundSourceId,
  kind,
  value,
  label,
  readOnly,
}: {
  taskCode: string;
  unitCode: string;
  fundSourceId: number;
  kind: 'budget' | 'settlement';
  value: string;
  label: string;
  readOnly?: boolean;
}) {
  const setBudgetField = useStrategicPlanStore((s) => s.setBudgetField);
  const parsed = parseAmount(value);
  if (readOnly) {
    return <span className="tabular-nums">{fmtWon(parsed)}</span>;
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
        setBudgetField(taskCode, unitCode, fundSourceId, kind, e.target.value)
      }
      className={cn(
        'h-8 w-32 text-right tabular-nums',
        invalid && 'border-destructive',
      )}
    />
  );
}

export function TaskBudgetGrandTotal({
  taskCode,
  units,
  fundSources,
  year,
  budgetTotal,
  settlementTotal,
}: {
  taskCode: string;
  units: Array<{ code: string; name: string }>;
  fundSources: SpFundSource[];
  year: number;
  budgetTotal: number | null;
  settlementTotal: number | null;
}) {
  const budgets = useStrategicPlanStore((s) => s.budgets);
  const executionRate =
    budgetTotal !== null && budgetTotal > 0 && settlementTotal !== null
      ? (settlementTotal / budgetTotal) * 100
      : null;

  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <p className="mb-2 text-sm font-bold">
        실행과제 총계
        <span className="ml-2 font-normal">
          {taskCode} · TASK {units.length}건
        </span>
      </p>
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr>
            <th className="px-2 py-1.5 text-left font-bold">재원</th>
            <th className="px-2 py-1.5 text-left font-bold">{year} 예산(원)</th>
            <th className="px-2 py-1.5 text-left font-bold">{year} 결산(원)</th>
            <th className="px-2 py-1.5 text-left font-bold">집행률</th>
          </tr>
        </thead>
        <tbody>
          {fundSources.map((fund) => {
            const b = sumAmounts(
              units.map((unit) =>
                parseAmount(
                  budgets[budgetKey(taskCode, unit.code, fund.fundSourceId)]
                    ?.budget ?? '',
                ),
              ),
            );
            const s = sumAmounts(
              units.map((unit) =>
                parseAmount(
                  budgets[budgetKey(taskCode, unit.code, fund.fundSourceId)]
                    ?.settlement ?? '',
                ),
              ),
            );
            const rate =
              b !== null && b > 0 && s !== null ? (s / b) * 100 : null;
            return (
              <tr key={fund.fundSourceId} className="border-b last:border-b-0">
                <td className="px-2 py-1.5">{fund.fundSourceName}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmtWon(b)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmtWon(s)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {rate === null ? '–' : `${fmt1(rate)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/60 font-bold">
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
  );
}

export function BudgetAmountTable({
  taskCode,
  unitCode,
  unitName,
  fundSources,
  year,
  readOnly,
}: {
  taskCode: string;
  unitCode: string;
  unitName?: string;
  fundSources: SpFundSource[];
  year: number;
  readOnly?: boolean;
}) {
  const budgets = useStrategicPlanStore((s) => s.budgets);
  const rows = unitBudgetRows(budgets, taskCode, unitCode, fundSources);
  const budgetTotal = sumAmounts(rows.map((r) => parseAmount(r.budget)));
  const settlementTotal = sumAmounts(rows.map((r) => parseAmount(r.settlement)));
  const executionRate =
    budgetTotal !== null && budgetTotal > 0 && settlementTotal !== null
      ? (settlementTotal / budgetTotal) * 100
      : null;

  return (
    <div>
      {unitName ? (
        <p className="mb-2 text-sm font-bold">
          {unitCode}
          <span className="ml-2 font-normal">{unitName}</span>
        </p>
      ) : null}
      <table className="w-full text-sm">
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
            const rate =
              b !== null && b > 0 && s !== null ? (s / b) * 100 : null;
            return (
              <tr key={fund.fundSourceId} className="border-b last:border-b-0">
                <td className="px-2 py-1.5">{fund.fundSourceName}</td>
                <td className="px-2 py-1.5 text-right">
                  <div className="flex justify-end">
                    <AmountInput
                      taskCode={taskCode}
                      unitCode={unitCode}
                      fundSourceId={fund.fundSourceId}
                      kind="budget"
                      value={row.budget}
                      label={`${unitName ?? unitCode} ${fund.fundSourceName} ${year} 예산`}
                      readOnly={readOnly}
                    />
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <div className="flex justify-end">
                    <AmountInput
                      taskCode={taskCode}
                      unitCode={unitCode}
                      fundSourceId={fund.fundSourceId}
                      kind="settlement"
                      value={row.settlement}
                      label={`${unitName ?? unitCode} ${fund.fundSourceName} ${year} 결산`}
                      readOnly={readOnly}
                    />
                  </div>
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
  );
}
