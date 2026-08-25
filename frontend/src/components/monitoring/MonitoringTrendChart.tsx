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
import { formatNumber, formatValueWithUnit } from '@/lib/dataFormatters';
import type { YearValueMap } from '@/lib/monitoring/types';

export function MonitoringTrendChart({
  years,
  values,
  unit,
  label,
  second,
}: {
  years: number[];
  values: YearValueMap;
  unit: string | null;
  label: string;
  second?: { values: YearValueMap; label: string };
}) {
  const data = years.map((year) => ({
    year,
    value: values[year] ?? null,
    second: second ? (second.values[year] ?? null) : undefined,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => formatNumber(typeof v === 'number' ? v : null)}
          />
          <Tooltip
            formatter={(value, name) => [
              typeof value === 'number'
                ? formatValueWithUnit(value, unit)
                : '-',
              String(name),
            ]}
            labelFormatter={(year) => `${year}년`}
          />
          {second ? <Legend /> : null}
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke="#50B1D1"
            strokeWidth={3}
            dot={{ r: 4 }}
            connectNulls={false}
          />
          {second ? (
            <Line
              type="monotone"
              dataKey="second"
              name={second.label}
              stroke="#B91C1C"
              strokeWidth={3}
              dot={{ r: 4 }}
              connectNulls={false}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
