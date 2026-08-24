'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { achievementRate, fmt, fmt1 } from '@/lib/strategic-plan/format';
import { goalAccent } from '@/lib/strategic-plan/goalAccent';
import type { SpEvaluationDraft, SpKpi, SpTask } from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import { useStrategicPlanStore } from '@/store/useStrategicPlanStore';
import { EmptyState, SectionLabel } from './ui';

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const text = (value ?? '').trim();
  return (
    <div className="grid gap-1">
      <SectionLabel>{label}</SectionLabel>
      <p className="whitespace-pre-wrap text-sm">{text || '–'}</p>
    </div>
  );
}

function KpiTable({
  task,
  year,
}: {
  task: SpTask;
  year: number;
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
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-2 py-1.5 text-left font-bold">코드</th>
            <th className="px-2 py-1.5 text-left font-bold">지표명</th>
            <th className="px-2 py-1.5 text-right font-bold">기준값</th>
            <th className="px-2 py-1.5 text-right font-bold">{year} 목표</th>
            <th className="px-2 py-1.5 text-right font-bold">{year} 실적</th>
            <th className="px-2 py-1.5 text-right font-bold">달성률</th>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportCard({
  task,
  draft,
  year,
}: {
  task: SpTask;
  draft: SpEvaluationDraft | undefined;
  year: number;
}) {
  const accent = goalAccent(task.goalId);
  return (
    <Card className={cn('border-l-4', accent.border)}>
      <CardContent className="space-y-5 p-4">
        <div>
          <h3 className="font-bold">{task.taskName}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
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
          </div>
        </div>

        <div>
          <SectionLabel>성과지표 달성값 — {year}학년도</SectionLabel>
          <KpiTable task={task} year={year} />
        </div>

        <div className="space-y-3">
          <SectionLabel>부서 자체평가</SectionLabel>
          <Field label="추진실적 요약" value={draft?.deptSummary} />
          <Field
            label="부서 자체분석 및 개선 방향"
            value={draft?.deptAnalysis}
          />
          <Field label="자체점검" value={draft?.deptGrade} />
          <Field label="개선·환류 사항" value={draft?.deptImprovement} />
        </div>

        <div className="space-y-3">
          <SectionLabel>IR센터 자체평가</SectionLabel>
          <Field label="IR센터 평가" value={draft?.irGrade} />
          <Field label="기타 의견 및 환류 사항" value={draft?.irFeedback} />
        </div>

        <div className="space-y-3">
          <SectionLabel>만족도조사 기반 자체평가</SectionLabel>
          <Field label="자체점검" value={draft?.surveyGrade} />
          <Field
            label="만족도 조사 결과 분석과 개선"
            value={draft?.surveyAnalysis}
          />
          <Field label="환류사항" value={draft?.surveyFeedback} />
        </div>
      </CardContent>
    </Card>
  );
}

export function EvaluationReportView({ tasks }: { tasks: SpTask[] }) {
  const year = useStrategicPlanStore((s) => s.year);
  const evaluations = useStrategicPlanStore((s) => s.evaluations);

  if (tasks.length === 0) {
    return <EmptyState>조회할 실행과제가 없습니다.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {year}학년도 자체평가 입력 결과를 보고서 형식으로 보여 줍니다.
      </p>
      {tasks.map((task) => (
        <ReportCard
          key={task.taskCode}
          task={task}
          draft={evaluations[task.taskCode]}
          year={year}
        />
      ))}
    </div>
  );
}
