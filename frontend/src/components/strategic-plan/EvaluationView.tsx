'use client';

import { memo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { achievementRate, fmt, fmt1 } from '@/lib/strategic-plan/format';
import { goalAccent } from '@/lib/strategic-plan/goalAccent';
import {
  SP_EVAL_FIELDS,
  SP_STATUS_CLASS,
  SP_STATUS_LABEL,
  evaluationFilledCount,
  evaluationStatus,
} from '@/lib/strategic-plan/status';
import type {
  SpEvaluationDraft,
  SpEvaluationField,
  SpTask,
} from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import { useStrategicPlanStore } from '@/store/useStrategicPlanStore';
import { EmptyState, NativeSelect, SectionLabel } from './ui';

/** 개별 KPI 행. 스토어에서 자기 KPI만 구독해 실적 입력 시 카드 전체가 다시 그려지지 않게 한다. */
function EvalKpiRow({
  kpiCode,
  year,
  canEdit,
}: {
  kpiCode: string;
  year: number;
  canEdit: boolean;
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
      <td className="px-2 py-1.5">{kpi.kpiCode}</td>
      <td className="px-2 py-1.5">{kpi.kpiName}</td>
      <td className="px-2 py-1.5 text-muted-foreground">{kpi.unit ?? ''}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {fmt(kpi.baseline)}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(target)}</td>
      <td className="px-2 py-1.5 text-right">
        {canEdit ? (
          <Input
            type="number"
            step="any"
            inputMode="decimal"
            value={actual === null ? '' : String(actual)}
            onChange={(e) => setKpiResult(kpi.kpiCode, e.target.value)}
            aria-label={`${kpi.kpiCode} ${year} 실적값`}
            className="h-8 w-24 text-right tabular-nums"
          />
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
    </tr>
  );
}

interface FieldSpec {
  key: SpEvaluationField;
  label: string;
  type: 'textarea' | 'select';
  placeholder?: string;
  options?: string[];
}

const EvaluationCard = memo(function EvaluationCard({
  task,
  draft,
  year,
  deptGrades,
  irGrades,
  canEditResults,
}: {
  task: SpTask;
  draft: SpEvaluationDraft | undefined;
  year: number;
  deptGrades: string[];
  irGrades: string[];
  canEditResults: boolean;
}) {
  const setEvaluationField = useStrategicPlanStore(
    (s) => s.setEvaluationField,
  );
  const [open, setOpen] = useState(false);
  const accent = goalAccent(task.goalId);
  const status = evaluationStatus(draft);

  const sections: Array<{
    no: string;
    title: string;
    who: string;
    fields: FieldSpec[];
  }> = [
    {
      no: '②',
      title: '부서 자체평가',
      who: '책임부서 작성',
      fields: [
        {
          key: 'deptSummary',
          label: '추진실적 요약',
          type: 'textarea',
          placeholder: '해당 연도 주요 추진실적을 요약합니다.',
        },
        {
          key: 'deptAnalysis',
          label: '부서 자체분석 및 개선 방향',
          type: 'textarea',
          placeholder:
            '목표 대비 달성 수준과 그 원인, 개선 방향을 분석합니다.',
        },
        {
          key: 'deptGrade',
          label: '자체점검',
          type: 'select',
          options: deptGrades,
        },
        {
          key: 'deptImprovement',
          label: '개선·환류 사항',
          type: 'textarea',
          placeholder: '미흡 사항에 대한 개선·환류 사항을 기술합니다.',
        },
      ],
    },
    {
      no: '③',
      title: 'IR센터 자체평가',
      who: 'IR센터 작성',
      fields: [
        {
          key: 'irGrade',
          label: 'IR센터 평가',
          type: 'select',
          options: irGrades,
        },
        {
          key: 'irFeedback',
          label: '기타 의견 및 환류 사항',
          type: 'textarea',
          placeholder: 'IR센터 평가 의견과 환류 사항을 기술합니다.',
        },
      ],
    },
    {
      no: '④',
      title: '만족도조사 기반 자체평가',
      who: '책임부서 작성',
      fields: [
        {
          key: 'surveyGrade',
          label: '자체점검',
          type: 'select',
          options: deptGrades,
        },
        {
          key: 'surveyAnalysis',
          label: '만족도 조사 결과 분석과 개선',
          type: 'textarea',
          placeholder:
            '만족도 조사 결과를 분석하고, 그에 따른 개선 방향을 기술합니다.',
        },
        {
          key: 'surveyFeedback',
          label: '환류사항',
          type: 'textarea',
          placeholder: '조사 결과를 반영한 환류사항을 기술합니다.',
        },
      ],
    },
  ];

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
            <Badge variant="outline">
              {task.strategyId}
            </Badge>
            {task.isSpecialized && <Badge variant="secondary">특성화 연계</Badge>}
          </span>
        </span>
        <Badge variant="outline" className={cn('shrink-0', SP_STATUS_CLASS[status])}>
          {evaluationFilledCount(draft)}/{SP_EVAL_FIELDS.length} 작성
        </Badge>
      </button>

      {open && (
        <CardContent className="space-y-5 border-t pt-4">
          {task.subtasks.length > 0 && (
            <div>
              <SectionLabel>세부 TASK (참고)</SectionLabel>
              <ul className="space-y-0.5 text-sm">
                {task.subtasks.map((sub) => (
                  <li key={sub.subtaskId}>
                    {sub.subtaskName}
                    <span className="ml-2 text-muted-foreground">
                      {sub.subtaskCode}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <SectionLabel>
              ① 성과지표 달성값 — {year}학년도 목표 대비
            </SectionLabel>
            {task.kpiCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">연계 KPI 없음</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-bold">코드</th>
                      <th className="px-2 py-1.5 text-left font-bold">지표명</th>
                      <th className="px-2 py-1.5 text-left font-bold">단위</th>
                      <th className="px-2 py-1.5 text-right font-bold">기준값</th>
                      <th className="px-2 py-1.5 text-right font-bold">
                        &apos;{String(year).slice(2)} 목표
                      </th>
                      <th className="px-2 py-1.5 text-right font-bold">실적값</th>
                      <th className="px-2 py-1.5 text-right font-bold">달성률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.kpiCodes.map((code) => (
                      <EvalKpiRow
                        key={code}
                        kpiCode={code}
                        year={year}
                        canEdit={canEditResults}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!canEditResults && (
              <p className="mt-1 text-muted-foreground">
                실적값은 관리자 화면에서 입력합니다.
              </p>
            )}
          </div>

          {sections.map((section) => (
            <div key={section.no}>
              <SectionLabel>
                {section.no} {section.title} · {section.who}
              </SectionLabel>
              <div className="grid gap-3">
                {section.fields.map((field) => {
                  const id = `ev-${task.taskCode}-${field.key}`;
                  const value = draft?.[field.key] ?? '';
                  return (
                    <div key={field.key} className="grid gap-1.5">
                      <Label htmlFor={id}>{field.label}</Label>
                      {field.type === 'select' ? (
                        <NativeSelect
                          id={id}
                          value={value}
                          onChange={(e) =>
                            setEvaluationField(
                              task.taskCode,
                              field.key,
                              e.target.value,
                            )
                          }
                          className="w-40"
                        >
                          <option value="">미선택</option>
                          {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Textarea
                          id={id}
                          rows={3}
                          value={value}
                          placeholder={field.placeholder}
                          onChange={(e) =>
                            setEvaluationField(
                              task.taskCode,
                              field.key,
                              e.target.value,
                            )
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
  deptGrades,
  irGrades,
  canEditResults,
}: {
  tasks: SpTask[];
  deptGrades: string[];
  irGrades: string[];
  canEditResults: boolean;
}) {
  const year = useStrategicPlanStore((s) => s.year);
  const evaluations = useStrategicPlanStore((s) => s.evaluations);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <EvaluationSummary tasks={tasks} />
        <span className="text-muted-foreground">
          {year}학년도 · 입력하면 자동 저장됩니다.
        </span>
      </div>

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
              irGrades={irGrades}
              canEditResults={canEditResults}
            />
          ))}
        </div>
      )}
    </div>
  );
}
