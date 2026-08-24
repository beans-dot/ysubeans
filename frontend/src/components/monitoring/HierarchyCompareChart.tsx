'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatValueWithUnit } from '@/lib/dataFormatters';
import {
  buildCompareRows,
  sortCompareRows,
  type CompareSortDir,
  type CompareSortKey,
} from '@/lib/monitoring/hierarchyCompare';
import {
  assignHighlightBands,
  COMPARE_BAR_COLORS,
  highlightBarFill,
} from '@/lib/monitoring/percentiles';
import type { KpiViewModel } from '@/lib/monitoring/fetchMonitoringData';
import type { HighlightBand, OrgStructure } from '@/lib/monitoring/types';
import { cn } from '@/lib/utils';

const SORT_KEYS: Array<{ key: CompareSortKey; label: string }> = [
  { key: 'value', label: '달성값순' },
  { key: 'name', label: '이름순' },
  { key: 'order', label: '학과나열순' },
];

export function HierarchyCompareChart({
  view,
  org,
}: {
  view: KpiViewModel;
  org: OrgStructure;
}) {
  const [showSeries, setShowSeries] = useState(true);
  const [showDepts, setShowDepts] = useState(true);
  const [sortKey, setSortKey] = useState<CompareSortKey>('order');
  const [sortDir, setSortDir] = useState<CompareSortDir>('asc');

  const rows = useMemo(() => {
    const built = buildCompareRows(view, org, { showSeries, showDepts });
    return sortCompareRows(built, sortKey, sortDir);
  }, [view, org, showSeries, showDepts, sortKey, sortDir]);

  const chartData = useMemo(() => {
    const bands = new Map<string, HighlightBand>();
    (['series', 'dept'] as const).forEach((kind) => {
      const kindBands = assignHighlightBands(
        rows
          .filter((row) => row.kind === kind)
          .map((row) => ({ id: row.id, value: row.value })),
        view.kpi.direction,
      );
      Object.entries(kindBands).forEach(([id, band]) => bands.set(id, band));
    });

    return rows.map((row) => ({
      ...row,
      band: bands.get(row.id) ?? 'none',
      barValue: row.value,
      axisLabel:
        row.kind === 'series' ? `[계열] ${row.name}` : `[학과] ${row.name}`,
    }));
  }, [rows, view.kpi.direction]);

  const height = Math.max(280, chartData.length * 28);

  if (!view.hasHierarchy) {
    return (
      <p className="text-sm text-muted-foreground">
        이 지표는 계열·학과 단위 데이터가 없어 하위 위계 비교를 할 수 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-5">
          <span className="text-sm font-bold">{view.selectedYear}년</span>
          <div className="flex items-center gap-2">
            <Switch
              id="compare-series"
              checked={showSeries}
              onCheckedChange={setShowSeries}
            />
            <Label htmlFor="compare-series">계열</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="compare-depts"
              checked={showDepts}
              onCheckedChange={setShowDepts}
            />
            <Label htmlFor="compare-depts">학과</Label>
          </div>
          <div className="flex max-w-full flex-nowrap items-center gap-3 overflow-x-auto whitespace-nowrap pb-1 text-xs text-muted-foreground">
            <span className="inline-flex shrink-0 items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: COMPARE_BAR_COLORS.series }}
              />
              계열
            </span>
            <span className="inline-flex shrink-0 items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: COMPARE_BAR_COLORS.dept }}
              />
              학과
            </span>
            <span className="inline-flex shrink-0 items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: COMPARE_BAR_COLORS.top }}
              />
              상위 10%
            </span>
            <span className="inline-flex shrink-0 items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: COMPARE_BAR_COLORS.bottom }}
              />
              하위 10%
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SORT_KEYS.map((item) => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={sortKey === item.key ? 'default' : 'outline'}
              onClick={() => setSortKey(item.key)}
            >
              {item.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
            }
          >
            {sortDir === 'asc' ? '오름차순' : '내림차순'}
          </Button>
        </div>
      </div>

      {!showSeries && !showDepts ? (
        <p className="text-sm text-muted-foreground">
          계열 또는 학과를 켜면 비교 차트가 표시됩니다.
        </p>
      ) : chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground">표시할 하위 위계 값이 없습니다.</p>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  typeof v === 'number' ? v.toLocaleString('ko-KR') : ''
                }
              />
              <YAxis
                type="category"
                dataKey="axisLabel"
                width={148}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <Tooltip
                formatter={(value) => [
                  typeof value === 'number'
                    ? formatValueWithUnit(value, view.unit)
                    : 'N/A',
                  view.label,
                ]}
              />
              <Bar dataKey="barValue" maxBarSize={18} radius={[0, 4, 4, 0]}>
                {chartData.map((row) => (
                  <Cell
                    key={row.id}
                    fill={highlightBarFill(row.band, row.kind)}
                    className={cn(row.value == null && 'opacity-30')}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
