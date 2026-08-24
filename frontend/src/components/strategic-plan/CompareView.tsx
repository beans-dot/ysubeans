'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fmt1 } from '@/lib/strategic-plan/format';
import type {
  SpCompare,
  SpCompareGroup,
  SpCompareIndicator,
} from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';
import {
  SP_COMPARE_MODES,
  useStrategicPlanStore,
  type SpCompareMode,
} from '@/store/useStrategicPlanStore';
import { EmptyState } from './ui';

const SERIES_COLORS = ['#2563EB', '#047857', '#F59E0B'];

interface Series {
  key: string;
  label: string;
  color: string;
}

function buildSeries(
  indicator: SpCompareIndicator,
  mode: SpCompareMode,
): Series[] {
  const prefix = indicator.priv ? '사립 ' : '';
  if (mode === 'jc') {
    return [
      { key: 'ysu', label: '연성대', color: SERIES_COLORS[0] },
      { key: 'jcMean', label: `${prefix}전문대 평균`, color: SERIES_COLORS[1] },
      {
        key: 'jcMedian',
        label: `${prefix}전문대 중앙값`,
        color: SERIES_COLORS[2],
      },
    ];
  }
  if (mode === 'all') {
    return [
      { key: 'ysu', label: '연성대', color: SERIES_COLORS[0] },
      { key: 'jcMean', label: `${prefix}전문대 평균`, color: SERIES_COLORS[1] },
      { key: 'unMean', label: `${prefix}4년제 평균`, color: SERIES_COLORS[2] },
    ];
  }
  return [
    { key: 'ysu', label: '연성대', color: SERIES_COLORS[0] },
    { key: 'unMean', label: `${prefix}4년제 평균`, color: SERIES_COLORS[1] },
    { key: 'unMedian', label: `${prefix}4년제 중앙값`, color: SERIES_COLORS[2] },
  ];
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : '−'}${fmt1(Math.abs(value))}`;
}

function rankLine(
  indicator: SpCompareIndicator,
  mode: SpCompareMode,
  latestYear: number,
) {
  const payload = indicator.years[latestYear];
  if (!payload) return null;
  const jc: SpCompareGroup = payload.jc ?? {};
  const un: SpCompareGroup = payload.un ?? {};
  const al: SpCompareGroup = payload.al ?? {};
  const prefix = indicator.priv ? '사립 ' : '';
  const shortYear = `'${String(latestYear).slice(2)}`;

  if (mode === 'jc') {
    return (
      <>
        <span>
          {shortYear} 공시: {prefix}전문대학{' '}
          <b>
            {jc.N}개교 중 {jc.rank}위
          </b>{' '}
          (연성대 {fmt1(jc.ysu)}%)
        </span>
        {typeof jc.ysu === 'number' && typeof jc.b5 === 'number' && (
          <span>
            TOP5 경계 {fmt1(jc.b5)}, 현재 {signed(jc.ysu - jc.b5)}p
          </span>
        )}
        {jc.top5 && <Badge variant="monitoring">TOP5 진입</Badge>}
      </>
    );
  }
  if (mode === 'all') {
    return (
      <>
        <span>
          {shortYear} 공시: 전체({prefix}전문대+4년제){' '}
          <b>
            {al.N}개교 중 {al.rank}위
          </b>{' '}
          (연성대 {fmt1(jc.ysu)}%)
        </span>
        {typeof jc.ysu === 'number' && typeof al.mean === 'number' && (
          <span>
            전체 평균 {fmt1(al.mean)} 대비 {signed(jc.ysu - al.mean)}p
          </span>
        )}
      </>
    );
  }
  return (
    <>
      <span>
        {shortYear} 공시: 연성대 {fmt1(jc.ysu)}% — {prefix}4년제 {un.N}개교 평균{' '}
        {fmt1(un.mean)} 대비{' '}
        {typeof jc.ysu === 'number' && typeof un.mean === 'number' ? (
          <b>{signed(jc.ysu - un.mean)}p</b>
        ) : (
          '–'
        )}
      </span>
      {typeof jc.ysu === 'number' && typeof un.median === 'number' && (
        <span>
          중앙값 {fmt1(un.median)} 대비 {signed(jc.ysu - un.median)}p
        </span>
      )}
    </>
  );
}

function IndicatorCard({
  indicator,
  years,
  mode,
}: {
  indicator: SpCompareIndicator;
  years: number[];
  mode: SpCompareMode;
}) {
  const series = buildSeries(indicator, mode);
  const data = years.map((year) => {
    const payload = indicator.years[year] ?? {};
    return {
      year,
      ysu: payload.jc?.ysu ?? null,
      jcMean: payload.jc?.mean ?? null,
      jcMedian: payload.jc?.median ?? null,
      unMean: payload.un?.mean ?? null,
      unMedian: payload.un?.median ?? null,
    };
  });
  const latestYear = years[years.length - 1];

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-bold">{indicator.name}</h3>
        <p className="mb-2 text-muted-foreground">
          {indicator.srcLabel ?? `알리미: ${indicator.src ?? '–'}`}
        </p>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
                tickFormatter={(v) =>
                  typeof v === 'number' ? fmt1(v) : String(v)
                }
              />
              <Tooltip
                formatter={(value, name) => [
                  typeof value === 'number' ? `${fmt1(value)}%` : '–',
                  String(name),
                ]}
                labelFormatter={(year) => `${year}년 공시`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, index) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={index === 0 ? 3 : 2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {rankLine(indicator, mode, latestYear)}
        </div>

        {indicator.alt && (
          <p className="mt-2 text-muted-foreground">
            병기 — {indicator.alt.label}: 연성대{' '}
            {years
              .map((year) => {
                const alt = indicator.alt?.years[year];
                return alt
                  ? `'${String(year).slice(2)} ${fmt1(alt.ysu)}`
                  : null;
              })
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function CompareView({
  compare,
  visionGoal,
}: {
  compare: SpCompare | null;
  visionGoal: string | null;
}) {
  const compareMode = useStrategicPlanStore((s) => s.compareMode);
  const setCompareMode = useStrategicPlanStore((s) => s.setCompareMode);

  if (!compare || compare.indicators.length === 0) {
    return <EmptyState>비교 데이터가 아직 없습니다.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-muted-foreground">
          {visionGoal && <b>비전목표 — {visionGoal}</b>} · 8대 주요지표 중 공시
          대응이 확정된 {compare.indicators.length}개입니다. 교육비환원율·장학금
          지급률은 대학재정알리미 사립대 기준 공시값입니다.
        </p>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="비교 대상"
        >
          {SP_COMPARE_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setCompareMode(mode.value)}
              aria-pressed={compareMode === mode.value}
              className={cn(
                'rounded-full border px-3 py-1 font-bold transition-colors',
                compareMode === mode.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {compare.indicators.map((indicator) => (
          <IndicatorCard
            key={indicator.id}
            indicator={indicator}
            years={compare.years}
            mode={compareMode}
          />
        ))}
      </div>
    </div>
  );
}
