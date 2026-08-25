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
    <div className="overflow-x-auto">
      {unitName ? (
        <p className="mb-2 text-sm font-bold">
          {unitCode}
          <span className="ml-2 font-normal">{unitName}</span>
        </p>
      ) : null}
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
            const rate =
              b !== null && b > 0 && s !== null ? (s / b) * 100 : null;
            return (
              <tr key={fund.fundSourceId} className="border-b last:border-b-0">
                <td className="px-2 py-1.5">{fund.fundSourceName}</td>
                <td className="px-2 py-1.5 text-right">
                  <AmountInput
                    taskCode={taskCode}
                    unitCode={unitCode}
                    fundSourceId={fund.fundSourceId}
                    kind="budget"
                    value={row.budget}
                    label={`${unitName ?? unitCode} ${fund.fundSourceName} ${year} 예산`}
                    readOnly={readOnly}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <AmountInput
                    taskCode={taskCode}
                    unitCode={unitCode}
                    fundSourceId={fund.fundSourceId}
                    kind="settlement"
                    value={row.settlement}
                    label={`${unitName ?? unitCode} ${fund.fundSourceName} ${year} 결산`}
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
  );
}
