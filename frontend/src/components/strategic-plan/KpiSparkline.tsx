'use client';

import { Line, LineChart, ReferenceLine, YAxis } from 'recharts';
import type { SpKpi } from '@/lib/strategic-plan/types';
import { goalAccent } from '@/lib/strategic-plan/goalAccent';

const WIDTH = 128;
const HEIGHT = 34;

/** KPI 연도별 목표 궤적. 점선은 기준값, 큰 점은 실적. */
export function KpiSparkline({
  kpi,
  years,
}: {
  kpi: SpKpi;
  years: number[];
}) {
  const data = years.map((year) => ({
    year,
    target: kpi.targets[year] ?? null,
    actual: kpi.results[year] ?? null,
  }));
  const values = data
    .flatMap((d) => [d.target, d.actual])
    .filter((v): v is number => typeof v === 'number');
  if (typeof kpi.baseline === 'number') values.push(kpi.baseline);
  if (values.length === 0) {
    return <span className="text-muted-foreground">–</span>;
  }

  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const pad = (hi - lo) * 0.15;
  const accent = goalAccent(kpi.goalId);

  return (
    <LineChart
      width={WIDTH}
      height={HEIGHT}
      data={data}
      margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
    >
      <YAxis hide domain={[lo - pad, hi + pad]} />
      {typeof kpi.baseline === 'number' && (
        <ReferenceLine
          y={kpi.baseline}
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="2 3"
          strokeWidth={1}
        />
      )}
      <Line
        type="linear"
        dataKey="target"
        stroke={accent.hex}
        strokeWidth={2}
        dot={{ r: 1.8, fill: accent.hex, strokeWidth: 0 }}
        connectNulls={false}
        isAnimationActive={false}
      />
      <Line
        type="linear"
        dataKey="actual"
        stroke={accent.hex}
        strokeWidth={0}
        dot={{ r: 3.2, fill: accent.hex, stroke: '#fff', strokeWidth: 1.2 }}
        connectNulls={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
