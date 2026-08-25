'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import {
  taskBudgetUnits,
  yoyImprovementRate,
} from '@/lib/strategic-plan/evalDraft';
import { achievementRate, fmt, fmt1, fmtWon, parseAmount } from '@/lib/strategic-plan/format';
import type {
  SpEvalActivity,
  SpEvaluationDraft,
  SpFundSource,
  SpKpi,
  SpSurveyItem,
  SpSurveyPlan,
  SpTask,
} from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import { logDataExport } from '@/lib/exportLog';
import { useStrategicPlanStore } from '@/store/useStrategicPlanStore';
import { BudgetAmountTable, TaskBudgetGrandTotal, sumAmounts, unitBudgetRows } from './BudgetAmountTable';
import { TaskHeading } from './TaskHeading';
import { EmptyState } from './ui';

const HANGUL_ITEMS = [
  '가',
  '나',
  '다',
  '라',
  '마',
  '바',
  '사',
  '아',
  '자',
  '차',
  '카',
  '타',
  '파',
  '하',
] as const;

function hangulItem(index: number) {
  return HANGUL_ITEMS[index] ?? String(index + 1);
}

function EvalText({ value }: { value: string | null | undefined }) {
  const text = (value ?? '').trim();
  return <p className="whitespace-pre-wrap">{text || '–'}</p>;
}

function DualEvalBox({
  itemTitle,
  dept,
  ir,
  irGrade,
}: {
  itemTitle?: string;
  dept: ReactNode;
  ir?: string | null;
  irGrade?: string | null;
}) {
  const grade = (irGrade ?? '').trim();
  return (
    <div className="space-y-2 rounded-md border p-3">
      {itemTitle ? <p className="font-bold">{itemTitle}</p> : null}
      <div className="space-y-1">
        <p className="font-bold">[부서 자체평가]</p>
        {dept}
      </div>
      <div data-eval-ir="1" className="space-y-1">
        <p className="font-bold">[IR 평가]{grade ? ` · ${grade}` : ''}</p>
        <EvalText value={ir} />
      </div>
    </div>
  );
}

function NumberedSection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 py-4 first:pt-0 last:pb-0">
      <h3 className="sp-eval-section-title mb-1">
        {n}. {title}
      </h3>
      {children}
    </section>
  );
}

function fundName(fundSources: SpFundSource[], id: number | null) {
  if (id === null) return '–';
  return fundSources.find((f) => f.fundSourceId === id)?.fundSourceName ?? '–';
}

function ActivityReportTable({
  rows,
  fundSources,
}: {
  rows: SpEvalActivity[];
  fundSources: SpFundSource[];
}) {
  const filled = rows.filter(
    (r) =>
      r.activityName.trim() ||
      r.performance.trim() ||
      r.executionAmount.trim() ||
      r.selfCheck.trim() ||
      r.nextYearFeedback.trim() ||
      r.fundSourceId !== null,
  );
  if (filled.length === 0) {
    return <p className="text-sm text-muted-foreground">작성된 사업이 없습니다.</p>;
  }
  const execTotal = filled
    .map((r) => parseAmount(r.executionAmount))
    .filter((v): v is number => v !== null)
    .reduce((a, b) => a + b, 0);
  const hasExec = filled.some((r) => parseAmount(r.executionAmount) !== null);

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-2 py-1.5 text-left font-bold">사업(Activity명)</th>
            <th className="px-2 py-1.5 text-left font-bold">추진실적</th>
            <th className="px-2 py-1.5 text-left font-bold">재원</th>
            <th className="px-2 py-1.5 text-left font-bold">집행액</th>
            <th className="px-2 py-1.5 text-left font-bold">자체점검</th>
            <th className="px-2 py-1.5 text-left font-bold">차년도 환류사항</th>
          </tr>
        </thead>
        <tbody>
          {filled.map((row) => (
            <tr key={row.id} className="border-b last:border-b-0 align-top">
              <td className="px-2 py-1.5">{row.activityName || '–'}</td>
              <td className="whitespace-pre-wrap px-2 py-1.5">
                {row.performance || '–'}
              </td>
              <td className="px-2 py-1.5">
                {fundName(fundSources, row.fundSourceId)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {fmtWon(parseAmount(row.executionAmount))}
              </td>
              <td className="px-2 py-1.5">{row.selfCheck || '–'}</td>
              <td className="whitespace-pre-wrap px-2 py-1.5">
                {row.nextYearFeedback || '–'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40 font-bold">
            <td className="px-2 py-1.5" colSpan={3}>
              집행액 합계
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              {hasExec ? fmtWon(execTotal) : '–'}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function KpiTable({
  task,
  year,
  poEvals,
}: {
  task: SpTask;
  year: number;
  poEvals: Record<string, string> | undefined;
}) {
  const kpis = useStrategicPlanStore((s) => s.tree?.kpis ?? []);
  const rows = task.kpiCodes
    .map((code) => kpis.find((k) => k.kpiCode === code))
    .filter((k): k is SpKpi => Boolean(k));
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">연계 KPI 없음</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-2 py-1.5 text-left font-bold">코드</th>
            <th className="px-2 py-1.5 text-left font-bold">지표명</th>
            <th className="px-2 py-1.5 text-left font-bold">기준값</th>
            <th className="px-2 py-1.5 text-left font-bold">{year} 목표</th>
            <th className="px-2 py-1.5 text-left font-bold">{year} 실적</th>
            <th className="px-2 py-1.5 text-left font-bold">달성률</th>
            <th className="px-2 py-1.5 text-left font-bold">PO 자체평가</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((kpi) => {
            const target = kpi.targets[year] ?? null;
            const actual = kpi.results[year] ?? null;
            const rate = achievementRate(actual, target);
            return (
              <tr key={kpi.kpiCode} className="border-b last:border-b-0">
                <td className="px-2 py-1.5">{kpi.kpiCode}</td>
                <td className="px-2 py-1.5">
                  {kpi.kpiName}
                  {kpi.unit ? (
                    <span className="ml-1 text-muted-foreground">
                      ({kpi.unit})
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmt(kpi.baseline)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmt(target)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmt(actual)}
                </td>
                <td
                  className={cn(
                    'px-2 py-1.5 text-right tabular-nums',
                    rate !== null && rate >= 100 && 'font-bold text-emerald-700',
                  )}
                >
                  {rate === null ? '–' : `${fmt1(rate)}%`}
                </td>
                <td className="px-2 py-1.5">{poEvals?.[kpi.kpiCode] || '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SurveyItemsTable({ items }: { items: SpSurveyItem[] }) {
  const filled = items.filter(
    (r) =>
      r.name.trim() ||
      r.prevValue.trim() ||
      r.thisValue.trim() ||
      r.selfEval.trim(),
  );
  if (filled.length === 0) {
    return <p className="text-sm text-muted-foreground">작성된 세부항목이 없습니다.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-2 py-1.5 text-left font-bold">만족도세부항목명</th>
            <th className="px-2 py-1.5 text-left font-bold">전년도 달성값</th>
            <th className="px-2 py-1.5 text-left font-bold">올해 달성값</th>
            <th className="px-2 py-1.5 text-left font-bold">전년대비 향상률</th>
            <th className="px-2 py-1.5 text-left font-bold">자체평가</th>
          </tr>
        </thead>
        <tbody>
          {filled.map((row) => {
            const rate = yoyImprovementRate(row.prevValue, row.thisValue);
            return (
              <tr key={row.id} className="border-b last:border-b-0">
                <td className="px-2 py-1.5">{row.name || '–'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {row.prevValue || '–'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {row.thisValue || '–'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {rate === null ? '–' : `${fmt1(rate)}%`}
                </td>
                <td className="px-2 py-1.5">{row.selfEval || '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SurveyPlansTable({ plans }: { plans: SpSurveyPlan[] }) {
  const filled = plans.filter(
    (r) =>
      r.category.trim() ||
      r.request.trim() ||
      r.planGrade.trim() ||
      r.planText.trim(),
  );
  if (filled.length === 0) {
    return <p className="text-sm text-muted-foreground">작성된 환류계획이 없습니다.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-2 py-1.5 text-left font-bold">구분</th>
            <th className="px-2 py-1.5 text-left font-bold">조사 내용 및 요구사항</th>
            <th className="px-2 py-1.5 text-left font-bold">환류계획</th>
          </tr>
        </thead>
        <tbody>
          {filled.map((row) => (
            <tr key={row.id} className="border-b last:border-b-0 align-top">
              <td className="px-2 py-1.5">{row.category || '–'}</td>
              <td className="whitespace-pre-wrap px-2 py-1.5">
                {row.request || '–'}
              </td>
              <td className="px-2 py-1.5">
                <p className="font-bold">{row.planGrade || '–'}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {row.planText || '–'}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportCard({
  task,
  draft,
  year,
  fundSources,
}: {
  task: SpTask;
  draft: SpEvaluationDraft | undefined;
  year: number;
  fundSources: SpFundSource[];
}) {
  const units = taskBudgetUnits(task);
  const budgets = useStrategicPlanStore((s) => s.budgets);
  const allRows = units.flatMap((unit) =>
    unitBudgetRows(budgets, task.taskCode, unit.code, fundSources),
  );
  const budgetTotal = sumAmounts(allRows.map((r) => parseAmount(r.budget)));
  const settlementTotal = sumAmounts(
    allRows.map((r) => parseAmount(r.settlement)),
  );
  const ir = draft?.irEval;

  return (
    <Card className="border-2 border-zinc-500 shadow-none">
      <CardContent className="p-4">
        <div className="mb-3">
          <TaskHeading task={task} />
        </div>

        <div className="divide-y divide-foreground/40">
          <NumberedSection n={1} title="TASK별 사업/프로그램 자체평가">
            {units.map((unit, index) => (
              <div key={unit.code} className="space-y-2">
                <div data-eval-budget="1" className="hidden space-y-1">
                  <p className="font-bold">
                    {unit.displayCode ?? unit.code} 예·결산 내역 — {year}학년도
                  </p>
                  <BudgetAmountTable
                    taskCode={task.taskCode}
                    unitCode={unit.code}
                    unitName={unit.name}
                    displayCode={unit.displayCode}
                    fundSources={fundSources}
                    year={year}
                    readOnly
                  />
                </div>
                <DualEvalBox
                  itemTitle={`${hangulItem(index)}. ${unit.displayCode ?? unit.code} ${unit.name}`}
                  dept={
                    <ActivityReportTable
                      rows={draft?.taskActivities?.[unit.code] ?? []}
                      fundSources={fundSources}
                    />
                  }
                  ir={ir?.taskComments?.[unit.code]}
                />
              </div>
            ))}
            <div data-eval-budget="1" className="hidden">
              <TaskBudgetGrandTotal
                taskCode={task.taskCode}
                units={units}
                fundSources={fundSources}
                year={year}
                budgetTotal={budgetTotal}
                settlementTotal={settlementTotal}
              />
            </div>
          </NumberedSection>

          <NumberedSection n={2} title={`성과지표 달성값 — ${year}학년도`}>
            <DualEvalBox
              dept={<KpiTable task={task} year={year} poEvals={draft?.kpiPoEvals} />}
              ir={ir?.kpiComment}
            />
          </NumberedSection>

          <NumberedSection n={3} title="주요 성과 및 우수사례">
            <DualEvalBox
              itemTitle="주요 성과(우수사례)"
              dept={<EvalText value={draft?.deptSummary} />}
              ir={ir?.achievements}
            />
            <DualEvalBox
              itemTitle="부서 자체분석 및 개선방향"
              dept={<EvalText value={draft?.deptAnalysis} />}
              ir={ir?.analysis}
            />
          </NumberedSection>

          <NumberedSection n={4} title="자체점검 및 진단">
            <DualEvalBox
              itemTitle={`예결산의 적절성${draft?.budgetAdequacyGrade ? ` · ${draft.budgetAdequacyGrade}` : ''}`}
              dept={<EvalText value={draft?.budgetAdequacy} />}
              ir={ir?.budgetAdequacy}
              irGrade={ir?.budgetAdequacyGrade}
            />
            <DualEvalBox
              itemTitle={`절차상 적절성${draft?.processAdequacyGrade ? ` · ${draft.processAdequacyGrade}` : ''}`}
              dept={<EvalText value={draft?.processAdequacy} />}
              ir={ir?.processAdequacy}
              irGrade={ir?.processAdequacyGrade}
            />
            <DualEvalBox
              itemTitle={`성과지표 적절성${draft?.kpiAdequacyGrade ? ` · ${draft.kpiAdequacyGrade}` : ''}`}
              dept={<EvalText value={draft?.kpiAdequacy} />}
              ir={ir?.kpiAdequacy}
              irGrade={ir?.kpiAdequacyGrade}
            />
          </NumberedSection>

          <NumberedSection n={5} title="만족도 조사 기반 자체평가">
            <DualEvalBox
              itemTitle="만족도 세부항목"
              dept={<SurveyItemsTable items={draft?.surveyItems ?? []} />}
              ir={ir?.surveyItemsComment}
            />
            <DualEvalBox
              itemTitle="만족도조사에 따른 환류계획"
              dept={<SurveyPlansTable plans={draft?.surveyPlans ?? []} />}
              ir={ir?.surveyPlansComment}
            />
          </NumberedSection>
        </div>
      </CardContent>
    </Card>
  );
}

type PdfScope = 'selected' | 'all';

export function EvaluationReportView({
  tasks,
  fundSources,
}: {
  tasks: SpTask[];
  fundSources: SpFundSource[];
}) {
  const year = useStrategicPlanStore((s) => s.year);
  const evaluations = useStrategicPlanStore((s) => s.evaluations);
  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scope, setScope] = useState<PdfScope>('all');
  const [includeBudget, setIncludeBudget] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const allSelected = tasks.length > 0 && selected.size === tasks.length;
  const someSelected = selected.size > 0 && !allSelected;

  const title = useMemo(() => `${year}학년도 자체평가 결과`, [year]);

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

  const openPdfDialog = () => {
    setExportError(null);
    setScope(selected.size > 0 ? 'selected' : 'all');
    setDialogOpen(true);
  };

  const downloadPdf = async () => {
    if (scope === 'selected' && selected.size === 0) {
      setExportError('출력할 실행과제를 선택해 주세요.');
      return;
    }
    const root = listRef.current;
    if (!root) return;

    const cards = Array.from(
      root.querySelectorAll<HTMLElement>('[data-eval-report-card]'),
    ).filter((el) => {
      if (scope === 'all') return true;
      const code = el.dataset.evalReportCard;
      return Boolean(code && selected.has(code));
    });
    if (cards.length === 0) {
      setExportError('출력할 실행과제가 없습니다.');
      return;
    }

    setExporting(true);
    setExportError(null);
    setProgress(null);
    const budgetNodes = includeBudget
      ? cards.flatMap((card) =>
          Array.from(card.querySelectorAll<HTMLElement>('[data-eval-budget]')),
        )
      : [];
    budgetNodes.forEach((node) => node.classList.remove('hidden'));
    if (budgetNodes.length > 0) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }
    try {
      const { exportEvalReportPdf } = await import(
        '@/lib/strategic-plan/exportEvalReportPdf'
      );
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const suffix =
        scope === 'all' ? '전체' : `선택${cards.length}건`;
      const filename = `자체평가결과_${year}_${suffix}_${stamp}.pdf`;
      await exportEvalReportPdf({
        header: headerRef.current,
        cards,
        filename,
        title,
        includeBudget,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      logDataExport({
        format: 'pdf',
        source: 'eval-report-pdf',
        filename,
        summary: `${title} · ${suffix}${includeBudget ? ' · 예결산 포함' : ''}`,
      });
      setDialogOpen(false);
    } catch {
      setExportError('PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      budgetNodes.forEach((node) => node.classList.add('hidden'));
      setExporting(false);
      setProgress(null);
    }
  };

  if (tasks.length === 0) {
    return <EmptyState>조회할 실행과제가 없습니다.</EmptyState>;
  }

  return (
    <div className="space-y-4">
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
        <Button size="sm" onClick={openPdfDialog}>
          <FileDown className="h-4 w-4" />
          PDF 다운로드
        </Button>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <div ref={headerRef} className="w-full space-y-1">
            <p className="text-sm text-muted-foreground">연성대학교</p>
            <p className="font-bold">{title}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            입력 결과를 보고서 형식으로 보여 줍니다. 실행과제를 고른 뒤 PDF로
            받거나, 전체를 출력할 수 있습니다.
          </p>
        </div>
      </div>

      <div ref={listRef} className="space-y-4">
        {tasks.map((task) => {
          const checked = selected.has(task.taskCode);
          return (
            <div key={task.taskCode} className="flex items-start gap-3">
              <div className="pt-5">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) =>
                    toggleTask(task.taskCode, value === true)
                  }
                  aria-label={`${task.taskCode} ${task.taskName} 선택`}
                />
              </div>
              <div
                className="min-w-0 flex-1"
                data-eval-report-card={task.taskCode}
              >
                <ReportCard
                  task={task}
                  draft={evaluations[task.taskCode]}
                  year={year}
                  fundSources={fundSources}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (exporting) return;
          setDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PDF 다운로드</DialogTitle>
            <DialogDescription>
              화면과 같은 보고서 양식으로 저장합니다. TASK별로 예·결산을 앞에
              넣을 수 있습니다.
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
                name="eval-pdf-scope"
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
                name="eval-pdf-scope"
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

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3">
              <span>
                <span className="font-bold">예.결산 포함</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  각 TASK 자체평가 앞에 결산조회 내역을 넣습니다.
                </span>
              </span>
              <Switch
                checked={includeBudget}
                onCheckedChange={setIncludeBudget}
                aria-label="예.결산 포함"
              />
            </label>
          </div>

          {exportError && (
            <p className="text-sm text-destructive">{exportError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={() => setDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={exporting || (scope === 'selected' && selected.size === 0)}
              onClick={() => void downloadPdf()}
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress
                    ? `만드는 중… ${progress.done}/${progress.total}`
                    : '만드는 중…'}
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  다운로드
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
