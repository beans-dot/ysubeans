'use client';

import { memo, useState, type ReactNode } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { SpCodeBadge } from '@/components/strategic-plan/SpCodeBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  activitiesForUnit,
  activityExecTotal,
  emptyActivity,
  emptySurveyItem,
  emptySurveyPlan,
  evaluationFilledCount,
  evaluationStatus,
  taskBudgetUnits,
  unitSettlementTotal,
  yoyImprovementRate,
} from '@/lib/strategic-plan/evalDraft';
import { achievementRate, fmt, fmt1, fmtWon } from '@/lib/strategic-plan/format';
import {
  SP_STATUS_CLASS,
  SP_STATUS_LABEL,
} from '@/lib/strategic-plan/status';
import type {
  SpEvalActivity,
  SpEvaluationDraft,
  SpEvaluationTextField,
  SpFundSource,
  SpSurveyItem,
  SpSurveyPlan,
  SpTask,
} from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import { useStrategicPlanStore } from '@/store/useStrategicPlanStore';
import { TaskHeading } from './TaskHeading';
import { EmptyState, NativeSelect, SectionLabel } from './ui';

function GradeSelect({
  id,
  value,
  options,
  disabled,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <NativeSelect
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn('w-36', className)}
    >
      <option value="">미선택</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </NativeSelect>
  );
}

function IrBlock({
  irMode,
  label,
  children,
}: {
  irMode: boolean;
  label?: string;
  children: ReactNode;
}) {
  if (!irMode) return null;
  return (
    <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3">
      <p className="mb-1.5 text-xs font-bold text-primary">
        {label ?? 'IR 평가'}
      </p>
      {children}
    </div>
  );
}

function EvalKpiRow({
  kpiCode,
  year,
  canEditResult,
  canEditPo,
  poEval,
  deptGrades,
  onPoEval,
}: {
  kpiCode: string;
  year: number;
  canEditResult: boolean;
  canEditPo: boolean;
  poEval: string;
  deptGrades: string[];
  onPoEval: (value: string) => void;
}) {
  const kpi = useStrategicPlanStore((s) =>
    s.tree?.kpis.find((k) => k.kpiCode === kpiCode),
  );
  const setKpiResult = useStrategicPlanStore((s) => s.setKpiResult);
  if (!kpi) return null;

  const target = kpi.targets[year] ?? null;
  const actual = kpi.results[year] ?? null;
  const rate = achievementRate(actual, target);

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-2 py-1.5">
        <SpCodeBadge level="kpi">{kpi.displayCode ?? kpi.kpiCode}</SpCodeBadge>
      </td>
      <td className="px-2 py-1.5">{kpi.kpiName}</td>
      <td className="px-2 py-1.5 text-muted-foreground">{kpi.unit ?? ''}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {fmt(kpi.baseline)}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(target)}</td>
      <td className="px-2 py-1.5 text-right">
        {canEditResult ? (
          <div className="flex justify-end">
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={actual === null ? '' : String(actual)}
              onChange={(e) => setKpiResult(kpi.kpiCode, e.target.value)}
              aria-label={`${kpi.kpiCode} ${year} 실적값`}
              className="h-8 w-24 text-right tabular-nums"
            />
          </div>
        ) : (
          <span className="tabular-nums">{fmt(actual)}</span>
        )}
      </td>
      <td
        className={cn(
          'px-2 py-1.5 text-right tabular-nums',
          rate !== null && rate >= 100 && 'font-bold text-emerald-700',
        )}
      >
        {rate === null ? '–' : `${fmt1(rate)}%`}
      </td>
      <td className="px-2 py-1.5">
        <GradeSelect
          value={poEval}
          options={deptGrades}
          disabled={!canEditPo}
          onChange={onPoEval}
          className="w-28"
        />
      </td>
    </tr>
  );
}

function ActivityTable({
  taskCode,
  unitCode,
  title,
  rows,
  fundSources,
  deptGrades,
  readOnly,
  onChange,
}: {
  taskCode: string;
  unitCode: string;
  title: ReactNode;
  rows: SpEvalActivity[];
  fundSources: SpFundSource[];
  deptGrades: string[];
  readOnly: boolean;
  onChange: (rows: SpEvalActivity[]) => void;
}) {
  const budgets = useStrategicPlanStore((s) => s.budgets);
  const execTotal = activityExecTotal(rows);
  const settleTotal = unitSettlementTotal(
    budgets,
    taskCode,
    unitCode,
    fundSources,
  );
  const mismatch =
    execTotal !== null &&
    (settleTotal === null || Math.round(execTotal) !== Math.round(settleTotal));

  const update = (index: number, patch: Partial<SpEvalActivity>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-bold">{title}</p>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => onChange([...rows, emptyActivity()])}
          >
            <Plus className="h-4 w-4" />
            사업 행 추가
          </Button>
        )}
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th align="left" className="px-2 py-1.5 text-left font-bold">사업(Activity명)</th>
              <th align="left" className="px-2 py-1.5 text-left font-bold">추진실적</th>
              <th align="left" className="px-2 py-1.5 text-left font-bold">재원</th>
              <th align="left" className="px-2 py-1.5 text-left font-bold">집행액</th>
              <th align="left" className="px-2 py-1.5 text-left font-bold">자체점검</th>
              <th align="left" className="px-2 py-1.5 text-left font-bold">차년도 환류사항</th>
              {!readOnly && <th className="w-10 px-1 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-b last:border-b-0 align-top">
                <td className="px-2 py-1.5">
                  <Input
                    value={row.activityName}
                    readOnly={readOnly}
                    onChange={(e) =>
                      update(index, { activityName: e.target.value })
                    }
                    className="h-8"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Textarea
                    rows={2}
                    value={row.performance}
                    readOnly={readOnly}
                    onChange={(e) =>
                      update(index, { performance: e.target.value })
                    }
                    className="min-h-[64px]"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <NativeSelect
                    value={row.fundSourceId === null ? '' : String(row.fundSourceId)}
                    disabled={readOnly}
                    onChange={(e) =>
                      update(index, {
                        fundSourceId:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="w-36"
                  >
                    <option value="">미선택</option>
                    {fundSources.map((fund) => (
                      <option key={fund.fundSourceId} value={fund.fundSourceId}>
                        {fund.fundSourceName}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <div className="flex justify-end">
                    <Input
                      value={row.executionAmount}
                      readOnly={readOnly}
                      inputMode="numeric"
                      onChange={(e) =>
                        update(index, { executionAmount: e.target.value })
                      }
                      className="h-8 w-28 text-right tabular-nums"
                    />
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <GradeSelect
                    value={row.selfCheck}
                    options={deptGrades}
                    disabled={readOnly}
                    onChange={(value) => update(index, { selfCheck: value })}
                    className="w-24"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Textarea
                    rows={2}
                    value={row.nextYearFeedback}
                    readOnly={readOnly}
                    onChange={(e) =>
                      update(index, { nextYearFeedback: e.target.value })
                    }
                    className="min-h-[64px]"
                  />
                </td>
                {!readOnly && (
                  <td className="px-1 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="행 삭제"
                      disabled={rows.length <= 1}
                      onClick={() =>
                        onChange(rows.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40 font-bold">
              <td className="px-2 py-1.5" colSpan={3}>
                집행액 합계
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {fmtWon(execTotal)}
              </td>
              <td colSpan={readOnly ? 2 : 3} />
            </tr>
          </tfoot>
        </table>
      </div>
      {mismatch && (
        <p className="text-sm font-bold text-red-600">
          집행액 합계가 해당 TASK 결산 합계와 일치하지 않습니다. (집행{' '}
          {fmtWon(execTotal)} / 결산 {fmtWon(settleTotal)})
        </p>
      )}
    </div>
  );
}

const EvaluationCard = memo(function EvaluationCard({
  task,
  draft,
  year,
  deptGrades,
  surveyPlanGrades,
  fundSources,
  canEditResults,
  irMode,
}: {
  task: SpTask;
  draft: SpEvaluationDraft | undefined;
  year: number;
  deptGrades: string[];
  surveyPlanGrades: string[];
  fundSources: SpFundSource[];
  canEditResults: boolean;
  irMode: boolean;
}) {
  const setEvaluationField = useStrategicPlanStore((s) => s.setEvaluationField);
  const setEvaluationData = useStrategicPlanStore((s) => s.setEvaluationData);
  const setIrEvalField = useStrategicPlanStore((s) => s.setIrEvalField);
  const [open, setOpen] = useState(false);
  const status = evaluationStatus(draft);
  const units = taskBudgetUnits(task);
  const deptLocked = irMode;
  const ir = draft?.irEval ?? {};

  const setText = (field: SpEvaluationTextField, value: string) => {
    setEvaluationField(task.taskCode, field, value);
  };

  const surveyItems =
    draft?.surveyItems && draft.surveyItems.length > 0
      ? draft.surveyItems
      : [emptySurveyItem()];
  const surveyPlans =
    draft?.surveyPlans && draft.surveyPlans.length > 0
      ? draft.surveyPlans
      : [emptySurveyPlan()];

  const diagnosis: Array<{
    textKey: SpEvaluationTextField;
    gradeKey: SpEvaluationTextField;
    irText: 'budgetAdequacy' | 'processAdequacy' | 'kpiAdequacy';
    irGrade:
      | 'budgetAdequacyGrade'
      | 'processAdequacyGrade'
      | 'kpiAdequacyGrade';
            label: string;
            placeholder: string;
          }> = [
            {
              textKey: 'budgetAdequacy',
              gradeKey: 'budgetAdequacyGrade',
              irText: 'budgetAdequacy',
              irGrade: 'budgetAdequacyGrade',
              label: '예결산의 적절성',
              placeholder:
                '예결산의 적절성에 대한 자체점검을 기술합니다. 예산 집행률에 따라 차년도 예산의 증감을 서술합니다.',
            },
            {
              textKey: 'processAdequacy',
              gradeKey: 'processAdequacyGrade',
              irText: 'processAdequacy',
              irGrade: 'processAdequacyGrade',
              label: '절차상 적절성',
              placeholder:
                '절차상 적절성(규정, 지침 구비 및 준수 여부 등)에 대한 자체점검을 기술합니다.',
            },
            {
              textKey: 'kpiAdequacy',
              gradeKey: 'kpiAdequacyGrade',
              irText: 'kpiAdequacy',
              irGrade: 'kpiAdequacyGrade',
              label: '성과지표 적절성',
              placeholder:
                '성과지표의 적절성(성과지표 산식, 구성, 산출시기 등)에 대한 자체점검을 기술합니다.',
            },
          ];

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
        <Badge variant="outline" className={cn('shrink-0', SP_STATUS_CLASS[status])}>
          {evaluationFilledCount(draft)}항목 작성
        </Badge>
      </button>

      {open && (
        <CardContent className="space-y-6 border-t pt-4">
          <div>
            <SectionLabel>① TASK별 사업/프로그램 자체평가</SectionLabel>
            <div className="space-y-5">
              {units.map((unit) => {
                const rows = activitiesForUnit(draft, unit.code);
                return (
                  <div key={unit.code} className="space-y-2">
                    <ActivityTable
                      taskCode={task.taskCode}
                      unitCode={unit.code}
                      title={
                        <>
                          <SpCodeBadge level="subtask">
                            {unit.displayCode ?? unit.code}
                          </SpCodeBadge>
                          <span className="ml-2 font-normal">{unit.name}</span>
                        </>
                      }
                      rows={rows}
                      fundSources={fundSources}
                      deptGrades={deptGrades}
                      readOnly={deptLocked}
                      onChange={(next) =>
                        setEvaluationData(task.taskCode, {
                          taskActivities: {
                            ...(draft?.taskActivities ?? {}),
                            [unit.code]: next,
                          },
                        })
                      }
                    />
                    <IrBlock irMode={irMode} label={`${unit.displayCode ?? unit.code} IR 평가`}>
                      <Textarea
                        rows={3}
                        value={ir.taskComments?.[unit.code] ?? ''}
                        placeholder="부서 작성 내용에 대한 첨삭 또는 추가 의견을 작성합니다."
                        onChange={(e) =>
                          setIrEvalField(task.taskCode, 'taskComments', {
                            ...(ir.taskComments ?? {}),
                            [unit.code]: e.target.value,
                          })
                        }
                      />
                    </IrBlock>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <SectionLabel>
              ② 성과지표 달성값 — {year}학년도 목표 대비
            </SectionLabel>
            {task.kpiCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">연계 KPI 없음</p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-bold">코드</th>
                      <th className="px-2 py-1.5 text-left font-bold">지표명</th>
                      <th className="px-2 py-1.5 text-left font-bold">단위</th>
                      <th className="px-2 py-1.5 text-left font-bold">기준값</th>
                      <th className="px-2 py-1.5 text-left font-bold">
                        &apos;{String(year).slice(2)} 목표
                      </th>
                      <th className="px-2 py-1.5 text-left font-bold">실적값</th>
                      <th className="px-2 py-1.5 text-left font-bold">달성률</th>
                      <th className="px-2 py-1.5 text-left font-bold">
                        PO 자체평가
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.kpiCodes.map((code) => (
                      <EvalKpiRow
                        key={code}
                        kpiCode={code}
                        year={year}
                        canEditResult={canEditResults && !irMode}
                        canEditPo={!irMode}
                        poEval={draft?.kpiPoEvals?.[code] ?? ''}
                        deptGrades={deptGrades}
                        onPoEval={(value) =>
                          setEvaluationData(task.taskCode, {
                            kpiPoEvals: {
                              ...(draft?.kpiPoEvals ?? {}),
                              [code]: value,
                            },
                          })
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!canEditResults && !irMode && (
              <p className="mt-1 text-muted-foreground">
                실적값은 관리자 화면에서 입력합니다.
              </p>
            )}
            <IrBlock irMode={irMode} label="성과지표 IR 평가">
              <p className="mb-2 text-sm text-muted-foreground">
                지표 실적값은 IR평가에서 입력하지 않습니다.
              </p>
              <Textarea
                rows={3}
                value={ir.kpiComment ?? ''}
                placeholder="성과지표에 대한 IR 의견을 작성합니다."
                onChange={(e) =>
                  setIrEvalField(task.taskCode, 'kpiComment', e.target.value)
                }
              />
            </IrBlock>
          </div>

          <div>
            <SectionLabel>③ 주요 성과 및 우수사례</SectionLabel>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`ev-${task.taskCode}-ach`}>
                  주요 성과(우수사례)
                </Label>
                <Textarea
                  id={`ev-${task.taskCode}-ach`}
                  rows={3}
                  readOnly={deptLocked}
                  value={draft?.deptSummary ?? ''}
                  placeholder="해당 연도 주요 성과와 우수사례를 기술합니다."
                  onChange={(e) => setText('deptSummary', e.target.value)}
                />
                <IrBlock irMode={irMode}>
                  <Textarea
                    rows={3}
                    value={ir.achievements ?? ''}
                    placeholder="첨삭 또는 추가 의견"
                    onChange={(e) =>
                      setIrEvalField(task.taskCode, 'achievements', e.target.value)
                    }
                  />
                </IrBlock>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`ev-${task.taskCode}-an`}>
                  부서 자체분석 및 개선방향
                </Label>
                <Textarea
                  id={`ev-${task.taskCode}-an`}
                  rows={3}
                  readOnly={deptLocked}
                  value={draft?.deptAnalysis ?? ''}
                  placeholder="목표 대비 달성 수준과 원인, 개선 방향을 분석합니다."
                  onChange={(e) => setText('deptAnalysis', e.target.value)}
                />
                <IrBlock irMode={irMode}>
                  <Textarea
                    rows={3}
                    value={ir.analysis ?? ''}
                    placeholder="첨삭 또는 추가 의견"
                    onChange={(e) =>
                      setIrEvalField(task.taskCode, 'analysis', e.target.value)
                    }
                  />
                </IrBlock>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>④ 자체점검 및 진단</SectionLabel>
            <div className="grid gap-4">
              {diagnosis.map((item) => (
                <div key={item.textKey} className="grid gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor={`ev-${task.taskCode}-${item.textKey}`}>
                      {item.label}
                    </Label>
                    <GradeSelect
                      value={draft?.[item.gradeKey] ?? ''}
                      options={deptGrades}
                      disabled={deptLocked}
                      onChange={(value) => setText(item.gradeKey, value)}
                    />
                  </div>
                  <Textarea
                    id={`ev-${task.taskCode}-${item.textKey}`}
                    rows={3}
                    readOnly={deptLocked}
                    value={draft?.[item.textKey] ?? ''}
                    placeholder={item.placeholder}
                    onChange={(e) => setText(item.textKey, e.target.value)}
                  />
                  <IrBlock irMode={irMode} label={`${item.label} IR 평가`}>
                    <div className="mb-2">
                      <GradeSelect
                        value={ir[item.irGrade] ?? ''}
                        options={deptGrades}
                        onChange={(value) =>
                          setIrEvalField(task.taskCode, item.irGrade, value)
                        }
                      />
                    </div>
                    <Textarea
                      rows={3}
                      value={ir[item.irText] ?? ''}
                      placeholder="첨삭 또는 추가 의견"
                      onChange={(e) =>
                        setIrEvalField(task.taskCode, item.irText, e.target.value)
                      }
                    />
                  </IrBlock>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>⑤ 만족도 조사 기반 자체평가</SectionLabel>
            <div className="grid gap-3">
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <SectionLabel className="mb-0">만족도 세부항목</SectionLabel>
                  {!deptLocked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() =>
                        setEvaluationData(task.taskCode, {
                          surveyItems: [...surveyItems, emptySurveyItem()],
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                      세부항목 추가
                    </Button>
                  )}
                </div>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-bold">
                          만족도세부항목명
                        </th>
                        <th className="px-2 py-1.5 text-left font-bold">
                          전년도 달성값
                        </th>
                        <th className="px-2 py-1.5 text-left font-bold">
                          올해 달성값
                        </th>
                        <th className="px-2 py-1.5 text-left font-bold">
                          전년대비 향상률
                        </th>
                        <th className="px-2 py-1.5 text-left font-bold">자체평가</th>
                        {!deptLocked && <th className="w-10 px-1 py-1.5" />}
                      </tr>
                    </thead>
                    <tbody>
                      {surveyItems.map((row, index) => {
                        const rate = yoyImprovementRate(row.prevValue, row.thisValue);
                        const update = (patch: Partial<SpSurveyItem>) => {
                          setEvaluationData(task.taskCode, {
                            surveyItems: surveyItems.map((item, i) =>
                              i === index ? { ...item, ...patch } : item,
                            ),
                          });
                        };
                        return (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className="px-2 py-1.5">
                              <Input
                                value={row.name}
                                readOnly={deptLocked}
                                onChange={(e) => update({ name: e.target.value })}
                                className="h-8"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <div className="flex justify-end">
                                <Input
                                  value={row.prevValue}
                                  readOnly={deptLocked}
                                  inputMode="decimal"
                                  onChange={(e) =>
                                    update({ prevValue: e.target.value })
                                  }
                                  className="h-8 w-24 text-right tabular-nums"
                                />
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <div className="flex justify-end">
                                <Input
                                  value={row.thisValue}
                                  readOnly={deptLocked}
                                  inputMode="decimal"
                                  onChange={(e) =>
                                    update({ thisValue: e.target.value })
                                  }
                                  className="h-8 w-24 text-right tabular-nums"
                                />
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {rate === null ? '–' : `${fmt1(rate)}%`}
                            </td>
                            <td className="px-2 py-1.5">
                              <GradeSelect
                                value={row.selfEval}
                                options={deptGrades}
                                disabled={deptLocked}
                                onChange={(value) => update({ selfEval: value })}
                                className="w-24"
                              />
                            </td>
                            {!deptLocked && (
                              <td className="px-1 py-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={surveyItems.length <= 1}
                                  onClick={() =>
                                    setEvaluationData(task.taskCode, {
                                      surveyItems: surveyItems.filter(
                                        (_, i) => i !== index,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <IrBlock irMode={irMode} label="만족도 세부항목 IR 평가">
                  <Textarea
                    rows={3}
                    value={ir.surveyItemsComment ?? ''}
                    placeholder="첨삭 또는 추가 의견"
                    onChange={(e) =>
                      setIrEvalField(
                        task.taskCode,
                        'surveyItemsComment',
                        e.target.value,
                      )
                    }
                  />
                </IrBlock>
              </div>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <SectionLabel className="mb-0">
                    만족도조사에 따른 환류계획
                  </SectionLabel>
                  {!deptLocked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() =>
                        setEvaluationData(task.taskCode, {
                          surveyPlans: [...surveyPlans, emptySurveyPlan()],
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                      환류계획 행 추가
                    </Button>
                  )}
                </div>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-bold">구분</th>
                        <th className="px-2 py-1.5 text-left font-bold">
                          조사 내용 및 요구사항
                        </th>
                        <th className="px-2 py-1.5 text-left font-bold">환류계획</th>
                        {!deptLocked && <th className="w-10 px-1 py-1.5" />}
                      </tr>
                    </thead>
                    <tbody>
                      {surveyPlans.map((row, index) => {
                        const update = (patch: Partial<SpSurveyPlan>) => {
                          setEvaluationData(task.taskCode, {
                            surveyPlans: surveyPlans.map((item, i) =>
                              i === index ? { ...item, ...patch } : item,
                            ),
                          });
                        };
                        return (
                          <tr key={row.id} className="border-b last:border-b-0 align-top">
                            <td className="px-2 py-1.5">
                              <Input
                                value={row.category}
                                readOnly={deptLocked}
                                onChange={(e) =>
                                  update({ category: e.target.value })
                                }
                                className="h-8"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Textarea
                                rows={2}
                                value={row.request}
                                readOnly={deptLocked}
                                onChange={(e) =>
                                  update({ request: e.target.value })
                                }
                                className="min-h-[64px]"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <GradeSelect
                                value={row.planGrade}
                                options={surveyPlanGrades}
                                disabled={deptLocked}
                                onChange={(value) =>
                                  update({ planGrade: value })
                                }
                                className="mb-1.5 w-32"
                              />
                              <Textarea
                                rows={2}
                                value={row.planText}
                                readOnly={deptLocked}
                                placeholder="환류계획을 서술합니다."
                                onChange={(e) =>
                                  update({ planText: e.target.value })
                                }
                                className="min-h-[64px]"
                              />
                            </td>
                            {!deptLocked && (
                              <td className="px-1 py-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={surveyPlans.length <= 1}
                                  onClick={() =>
                                    setEvaluationData(task.taskCode, {
                                      surveyPlans: surveyPlans.filter(
                                        (_, i) => i !== index,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <IrBlock irMode={irMode} label="환류계획 IR 평가">
                  <Textarea
                    rows={3}
                    value={ir.surveyPlansComment ?? ''}
                    placeholder="첨삭 또는 추가 의견"
                    onChange={(e) =>
                      setIrEvalField(
                        task.taskCode,
                        'surveyPlansComment',
                        e.target.value,
                      )
                    }
                  />
                </IrBlock>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
});

function EvaluationSummary({ tasks }: { tasks: SpTask[] }) {
  const evaluations = useStrategicPlanStore((s) => s.evaluations);
  let done = 0;
  let part = 0;
  for (const task of tasks) {
    const status = evaluationStatus(evaluations[task.taskCode]);
    if (status === 'done') done += 1;
    else if (status === 'part') part += 1;
  }
  const none = tasks.length - done - part;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
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
        {SP_STATUS_LABEL.none} <b>{none}</b>건
      </span>
    </div>
  );
}

export function EvaluationView({
  tasks,
  fundSources,
  deptGrades,
  surveyPlanGrades,
  canEditResults,
}: {
  tasks: SpTask[];
  fundSources: SpFundSource[];
  deptGrades: string[];
  surveyPlanGrades: string[];
  canEditResults: boolean;
}) {
  const year = useStrategicPlanStore((s) => s.year);
  const evaluations = useStrategicPlanStore((s) => s.evaluations);
  const [irMode, setIrMode] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <EvaluationSummary tasks={tasks} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={irMode ? 'default' : 'outline'}
            aria-pressed={irMode}
            onClick={() => setIrMode((v) => !v)}
          >
            IR평가 모드
          </Button>
          <span className="text-muted-foreground">
            {year}학년도 · 입력하면 자동 저장됩니다.
          </span>
        </div>
      </div>

      {irMode && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          IR평가 모드입니다. 부서가 입력한 내용은 그대로 보이며 수정할 수
          없습니다. 각 항목 아래에 IR 평가를 이어서 작성하세요. 지표 실적값은
          입력하지 않습니다.
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState>조건에 맞는 실행과제가 없습니다.</EmptyState>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <EvaluationCard
              key={task.taskCode}
              task={task}
              draft={evaluations[task.taskCode]}
              year={year}
              deptGrades={deptGrades}
              surveyPlanGrades={surveyPlanGrades}
              fundSources={fundSources}
              canEditResults={canEditResults}
              irMode={irMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
