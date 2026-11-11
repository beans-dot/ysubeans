'use client';

import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import * as XLSX from 'xlsx';
import { formatNumber } from '@/lib/dataFormatters';
import { logDataExport } from '@/lib/exportLog';
import {
  levelLabelForRow,
  orderPivotRows,
  type HierarchyExportTarget,
} from '@/lib/hierarchyExport';
import type { PivotResult } from '@/lib/api';
import { useAnalysisStore } from '@/store/AnalysisStoreProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HierarchyExcelButton } from './HierarchyExcelButton';

function exportSource(pathname: string, descendants: boolean) {
  const base = pathname.includes('competitiveness')
    ? 'competitiveness-pivot'
    : 'dashboard-pivot';
  return descendants ? `${base}-hierarchy` : base;
}

export function PivotDataGrid() {
  const pivot = useAnalysisStore((s) => s.pivot);
  const selectedMetrics = useAnalysisStore((s) => s.selectedMetrics);
  const tableRef = useRef<HTMLTableElement>(null);
  const pathname = usePathname();

  const hasData = pivot && pivot.rows.length > 0;

  const handleExcel = () => {
    if (!tableRef.current) return;
    // [강제] 화면에 보이는 HTML 테이블 구조 그대로 xlsx로 변환
    const worksheet = XLSX.utils.table_to_sheet(tableRef.current);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IR_Pivot');
    const filename = `ysu-ir-pivot-${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, filename);
    logDataExport({
      format: 'xlsx',
      source: exportSource(pathname, false),
      filename,
      summary: pivot
        ? `피벗 평균 ${pivot.rows.length}행 · ${pivot.years.join(', ')}`
        : undefined,
    });
  };

  const handleDescendants = (
    result: { pivot: PivotResult; targets: HierarchyExportTarget[] },
  ) => {
    const metricIds = selectedMetrics.map((metric) => metric.metricId);
    const ordered = orderPivotRows(result.pivot.rows, result.targets, metricIds);
    const years = result.pivot.years;
    const rows: Array<Array<string | number>> = [
      ['위계', '대상', '지표', '단위', ...years.map(String)],
      ...ordered.map((row) => [
        levelLabelForRow(row, result.targets),
        row.targetLabel,
        row.metricName,
        row.metricUnit ?? '-',
        ...years.map((year) => {
          const value = row.values[year];
          return value === null || value === undefined ? '' : value;
        }),
      ]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 36 },
      { wch: 28 },
      { wch: 10 },
      ...years.map(() => ({ wch: 12 })),
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '하위위계');
    const filename = `ysu-ir-pivot-hierarchy-${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, filename);
    logDataExport({
      format: 'xlsx',
      source: exportSource(pathname, true),
      filename,
      summary: `피벗 하위위계 ${ordered.length}행 · ${years.join(', ')}`,
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>피벗 데이터</CardTitle>
        <HierarchyExcelButton
          disabled={!hasData}
          onAverage={handleExcel}
          onDescendants={handleDescendants}
        />
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            조회된 데이터가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              ref={tableRef}
              className="w-full border-collapse text-sm"
            >
              <thead>
                <tr className="bg-secondary">
                  <th className="border px-3 py-2 text-left font-bold">대상</th>
                  <th className="border px-3 py-2 text-left font-bold">지표</th>
                  <th className="border px-3 py-2 text-left font-bold">단위</th>
                  {pivot!.years.map((y) => (
                    <th key={y} className="border px-3 py-2 text-right font-bold">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivot!.rows.map((row) => (
                  <tr key={`${row.targetKey}-${row.metricId}`}>
                    <td className="border px-3 py-2">
                      <span
                        className={
                          row.isYeonsung ? 'font-bold text-primary' : ''
                        }
                      >
                        {row.targetLabel}
                      </span>
                    </td>
                    <td className="border px-3 py-2">{row.metricName}</td>
                    <td className="border px-3 py-2 text-muted-foreground">
                      {row.metricUnit ?? '-'}
                    </td>
                    {pivot!.years.map((y) => (
                      <td key={y} className="border px-3 py-2 text-right">
                        {formatNumber(row.values[y], row.metricUnit)}
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
