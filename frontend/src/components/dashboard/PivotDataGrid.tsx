'use client';

import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatNumber } from '@/lib/dataFormatters';
import { logDataExport } from '@/lib/exportLog';
import { useAnalysisStore } from '@/store/AnalysisStoreProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PivotDataGrid() {
  const pivot = useAnalysisStore((s) => s.pivot);
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
      source: pathname.includes('competitiveness')
        ? 'competitiveness-pivot'
        : 'dashboard-pivot',
      filename,
      summary: pivot
        ? `피벗 ${pivot.rows.length}행 · ${pivot.years.join(', ')}`
        : undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>피벗 데이터</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExcel}
          disabled={!hasData}
        >
          <FileSpreadsheet className="mr-1 h-4 w-4" /> 엑셀 다운로드
        </Button>
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
