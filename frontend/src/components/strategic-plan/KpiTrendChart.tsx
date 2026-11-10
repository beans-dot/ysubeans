'use client';

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import {
  achievementRate,
  fmt,
  fmt1,
  isInverseKpi,
} from '@/lib/strategic-plan/format';
import type { SpKpi } from '@/lib/strategic-plan/types';

const TARGET_COLOR = '#374151';
const UP_COLOR = '#DC2626';
const DOWN_COLOR = '#2563EB';
const FLAT_COLOR = '#9CA3AF';

interface TrendPoint {
  year: number;
  target: number | null;
  actual: number | null;
  actualColor: string;
}

/** 직전 연도 달성값이 있을 때만 오르내림을 칠한다. */
function actualBarColor(
  actual: number | null,
  previous: number | null,
): string {
  if (actual === null || previous === null) return FLAT_COLOR;
  if (actual > previous) return UP_COLOR;
  if (actual < previous) return DOWN_COLOR;
  return FLAT_COLOR;
}

function withUnit(value: number | null, unit: string | null): string {
  const text = fmt(value);
  if (text === '–' || !unit) return text;
  return `${text}${unit}`;
}

function TrendTooltip({
  active,
  payload,
  unit,
  inverse,
}: TooltipProps<ValueType, NameType> & {
  unit: string | null;
  inverse: boolean;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as TrendPoint | undefined;
  if (!point) return null;
  const rate = achievementRate(point.actual, point.target, inverse);

  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-bold text-foreground">{point.year}년</p>
      <ul className="space-y-1">
        <li className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-3 shrink-0"
            style={{ background: TARGET_COLOR }}
            aria-hidden
          />
          <span>목표값 {withUnit(point.target, unit)}</span>
        </li>
        <li className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-3 shrink-0 rounded-sm"
            style={{ background: point.actualColor }}
            aria-hidden
          />
          <span>달성값 {withUnit(point.actual, unit)}</span>
        </li>
        <li>달성률 {rate === null ? '–' : `${fmt1(rate)}%`}</li>
      </ul>
    </div>
  );
}

/** 연도별 실적 아래의 목표·달성 막대선 그래프. 부모 너비를 그대로 쓴다. */
export function KpiTrendChart({
  kpi,
  years,
}: {
  kpi: SpKpi;
  years: number[];
}) {
  const orderedYears = [...years].sort((a, b) => a - b);
  const data: TrendPoint[] = orderedYears.map((year, index) => {
    const actual = kpi.results[year] ?? null;
    const previousYear = index > 0 ? orderedYears[index - 1] : null;
    const previous =
      previousYear === null ? null : (kpi.results[previousYear] ?? null);
    return {
      year,
      target: kpi.targets[year] ?? null,
      actual,
      actualColor: actualBarColor(actual, previous),
    };
  });
  const hasValue = data.some(
    (point) => point.target !== null || point.actual !== null,
  );
  if (!hasValue) {
    return <p className="text-sm text-muted-foreground">표시할 추이가 없습니다.</p>;
  }

  const inverse = isInverseKpi(kpi.kpiCode, kpi.displayCode);

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            width={48}
            tickFormatter={(value) =>
              typeof value === 'number' ? fmt(value) : String(value)
            }
          />
          <Tooltip
            content={
              <TrendTooltip unit={kpi.unit} inverse={inverse} />
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            payload={[
              { value: '목표값', type: 'line', color: TARGET_COLOR, id: 'target' },
              { value: '상승', type: 'rect', color: UP_COLOR, id: 'up' },
              { value: '하락', type: 'rect', color: DOWN_COLOR, id: 'down' },
            ]}
          />
          <Bar
            dataKey="actual"
            name="달성값"
            maxBarSize={28}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          >
            {data.map((point) => (
              <Cell key={point.year} fill={point.actualColor} />
            ))}
          </Bar>
          <Line
            type="linear"
            dataKey="target"
            name="목표값"
            stroke={TARGET_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: TARGET_COLOR, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
