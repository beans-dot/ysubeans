'use client';

import { useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { PivotRow } from '@/lib/api';
import {
  descriptiveStats,
  formatDescriptiveNumber,
  formatMode,
  type DescriptiveStats,
} from '@/lib/descriptiveStats';
import { logDataExport } from '@/lib/exportLog';
import { useAnalysisStore } from '@/store/AnalysisStoreProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const STAT_HEADERS = [
  '평균(Mean)',
  '중앙값(Median)',
  '최빈값(Mode)',
  '분산(Variance)',
  '표준편차(Standard Deviation)',
  '범위(Range)',
  '사분위수(IQR)',
  '왜도(Skewness)',
  '첨도(Kurtosis)',
] as const;

function seriesName(row: PivotRow): string {
  const unit = row.metricUnit?.trim();
  const name = `${row.targetLabel} · ${row.metricName}`;
  return unit ? `${name} (${unit})` : name;
}

function statCells(stats: DescriptiveStats): string[] {
  return [
    formatDescriptiveNumber(stats.mean),
    formatDescriptiveNumber(stats.median),
    formatMode(stats.modes),
    formatDescriptiveNumber(stats.variance),
    formatDescriptiveNumber(stats.stdev),
    formatDescriptiveNumber(stats.range),
    formatDescriptiveNumber(stats.iqr),
    formatDescriptiveNumber(stats.skewness),
    formatDescriptiveNumber(stats.kurtosis),
  ];
}

export function DescriptiveStatsPanel() {
  const pivot = useAnalysisStore((s) => s.pivot);
  const tableRef = useRef<HTMLTableElement>(null);
  const pathname = usePathname();

  const hasData = pivot && pivot.rows.length > 0;

  const rows = useMemo(() => {
    if (!pivot) return [];
    return pivot.rows.map((row) => ({
      key: `${row.targetKey}-${row.metricId}`,
      name: seriesName(row),
      isYeonsung: row.isYeonsung,
      cells: statCells(
        descriptiveStats(pivot.years.map((year) => row.values[year])),
      ),
    }));
  }, [pivot]);

  const handleExcel = () => {
    if (!tableRef.current) return;
    const worksheet = XLSX.utils.table_to_sheet(tableRef.current);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IR_Descriptive');
    const filename = `ysu-ir-descriptive-${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, filename);
    logDataExport({
      format: 'xlsx',
      source: pathname.includes('competitiveness')
        ? 'competitiveness-descriptive'
        : 'dashboard-descriptive',
      filename,
      summary: pivot
        ? `기술통계 ${pivot.rows.length}행 · ${pivot.years.join(', ')}`
        : undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-row items-center justify-between gap-3">
          <CardTitle>기초 기술 통계 데이터</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleExcel}
            disabled={!hasData}
          >
            <FileSpreadsheet className="mr-1 h-4 w-4" /> 엑셀 다운로드
          </Button>
        </div>
        {hasData && (
          <CardDescription>
            조회 기간({pivot!.years.join(', ')}) 중 값이 있는 연도로
            계산합니다. 분산·표준편차·왜도·첨도는 그 연도 전체를 기준으로
            하며, 첨도는 정규분포를 0으로 하는 초과첨도입니다. 최빈값은 같은
            값이 두 번 이상일 때만 표시합니다.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            조회된 데이터가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-secondary">
                  <th className="whitespace-nowrap border px-3 py-2 text-left font-bold">
                    데이터명
                  </th>
                  {STAT_HEADERS.map((header) => (
                    <th
                      key={header}
                      className="whitespace-nowrap border px-3 py-2 text-right font-bold"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="whitespace-nowrap border px-3 py-2">
                      <span
                        className={
                          row.isYeonsung ? 'font-bold text-primary' : ''
                        }
                      >
                        {row.name}
                      </span>
                    </td>
                    {row.cells.map((cell, index) => (
                      <td
                        key={STAT_HEADERS[index]}
                        className="whitespace-nowrap border px-3 py-2 text-right tabular-nums"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
