'use client';

import { Settings2 } from 'lucide-react';
import { useMemo } from 'react';
import { useAnalysisStore } from '@/store/AnalysisStoreProvider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function ChartOptionsPanel() {
  const options = useAnalysisStore((s) => s.chartOptions);
  const setChartOption = useAnalysisStore((s) => s.setChartOption);
  const pivot = useAnalysisStore((s) => s.pivot);

  // 추세선 대상: 대상선택 × 지표선택 조합(현재 조회된 시리즈)
  const trendTargets = useMemo(() => {
    if (!pivot) return [] as Array<{ key: string; label: string }>;
    return pivot.rows.map((r) => ({
      key: `${r.targetKey}__${r.metricId}`,
      label: `[${r.targetLabel}] ${r.metricName}`,
    }));
  }, [pivot]);

  const toggleTrendSeries = (key: string, value: boolean) => {
    setChartOption('trendlineSeries', {
      ...options.trendlineSeries,
      [key]: value,
    });
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Settings2 className="h-4 w-4" /> 차트 옵션
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="opt-labels">데이터 라벨 표기</Label>
        <Switch
          id="opt-labels"
          checked={options.showDataLabels}
          onCheckedChange={(v) => setChartOption('showDataLabels', v)}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="opt-trend">추세선(Trendline)</Label>
        <Switch
          id="opt-trend"
          checked={options.showTrendline}
          onCheckedChange={(v) => setChartOption('showTrendline', v)}
        />
      </div>

      {options.showTrendline && (
        <div className="space-y-2 rounded-md border border-dashed bg-muted/40 p-2">
          <div className="text-xs font-semibold text-muted-foreground">
            추세선 표시 대상 (선택 데이터별)
          </div>
          {trendTargets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              대상과 지표를 선택하면 추세선 대상이 표시됩니다.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {trendTargets.map((t) => {
                const checked = options.trendlineSeries[t.key] !== false;
                return (
                  <li
                    key={t.key}
                    className="flex items-center justify-between gap-2"
                  >
                    <Label
                      htmlFor={`opt-trend-${t.key}`}
                      className="truncate text-xs font-normal"
                      title={t.label}
                    >
                      {t.label}
                    </Label>
                    <Switch
                      id={`opt-trend-${t.key}`}
                      checked={checked}
                      onCheckedChange={(v) => toggleTrendSeries(t.key, v)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor="opt-ref">기준선(Reference Line)</Label>
        <Switch
          id="opt-ref"
          checked={options.showReferenceLine}
          onCheckedChange={(v) => setChartOption('showReferenceLine', v)}
        />
      </div>

      {options.showReferenceLine && (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="opt-refval">기준값</Label>
          <Input
            id="opt-refval"
            type="number"
            className="h-8 w-28"
            value={options.referenceValue}
            onChange={(e) =>
              setChartOption('referenceValue', Number(e.target.value))
            }
          />
        </div>
      )}
    </div>
  );
}
