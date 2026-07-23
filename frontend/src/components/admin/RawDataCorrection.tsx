'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { Search } from 'lucide-react';
import {
  fetchRawCorrectionList,
  fetchRawCorrectionYears,
  patchRawCorrectionValue,
  type RawCorrectionItem,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

ModuleRegistry.registerModules([AllCommunityModule]);

const PAGE_SIZE = 100;

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg) && msg.length > 0) return msg.join('\n');
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export function RawDataCorrection() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<string>('');
  const [univCode, setUnivCode] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<RawCorrectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savingIds = useRef(new Set<number>());

  useEffect(() => {
    fetchRawCorrectionYears()
      .then((list) => {
        setYears(list);
        if (list.length > 0) {
          setYear(String(list[0]));
        } else {
          setYear(String(new Date().getFullYear()));
        }
      })
      .catch(() => {
        setYears([]);
        setYear(String(new Date().getFullYear()));
      });
  }, []);

  const load = useCallback(
    async (nextPage = 1) => {
      const parsedYear = Number.parseInt(year, 10);
      if (!Number.isFinite(parsedYear)) {
        setError('연도를 선택하거나 입력해 주세요.');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await fetchRawCorrectionList({
          year: parsedYear,
          univCode: univCode.trim() || undefined,
          deptCode: deptCode.trim() || undefined,
          q: q.trim() || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        });
        setRows(data.items);
        setTotal(data.total);
        setPage(nextPage);
        setStatusMsg(
          `${data.total.toLocaleString()}건 중 ${data.items.length}건 표시`,
        );
      } catch (err) {
        setRows([]);
        setTotal(0);
        setError(apiErrorMessage(err, '자체 데이터 조회에 실패했습니다.'));
      } finally {
        setLoading(false);
      }
    },
    [year, univCode, deptCode, q],
  );

  useEffect(() => {
    if (!year) return;
    void load(1);
    // 초기 연도 로드 시에만 자동 조회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const columnDefs = useMemo<ColDef<RawCorrectionItem>[]>(
    () => [
      {
        field: 'year',
        headerName: '연도',
        width: 90,
        editable: false,
      },
      {
        field: 'univCode',
        headerName: '대학코드',
        width: 120,
        editable: false,
      },
      {
        field: 'deptCode',
        headerName: '학과코드',
        width: 120,
        editable: false,
      },
      {
        field: 'metricId',
        headerName: '지표ID',
        width: 100,
        editable: false,
      },
      {
        field: 'metricName',
        headerName: '지표명',
        flex: 1,
        minWidth: 220,
        editable: false,
      },
      {
        field: 'metricValue',
        headerName: '지표값',
        width: 140,
        editable: true,
        cellClass: 'font-medium text-blue-700',
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
    }),
    [],
  );

  const onCellValueChanged = useCallback(
    async (event: CellValueChangedEvent<RawCorrectionItem>) => {
      const data = event.data;
      if (!data || event.colDef.field !== 'metricValue') return;

      const nextValue = String(event.newValue ?? '').trim();
      const prevValue = String(event.oldValue ?? '');

      if (nextValue === prevValue) {
        data.metricValue = prevValue;
        event.api.refreshCells({ rowNodes: [event.node!], force: true });
        return;
      }

      if (savingIds.current.has(data.rawId)) return;
      savingIds.current.add(data.rawId);
      setError(null);
      setStatusMsg(`rawId ${data.rawId} 저장 중…`);

      try {
        const updated = await patchRawCorrectionValue(data.rawId, nextValue);
        data.metricValue = updated.metricValue;
        event.api.refreshCells({ rowNodes: [event.node!], force: true });
        setStatusMsg(
          `저장 완료: ${updated.metricName} → ${updated.metricValue}`,
        );
      } catch (err) {
        data.metricValue = prevValue;
        event.api.refreshCells({ rowNodes: [event.node!], force: true });
        setError(apiErrorMessage(err, '저장에 실패했습니다. 값이 복원되었습니다.'));
        setStatusMsg(null);
      } finally {
        savingIds.current.delete(data.rawId);
      }
    },
    [],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">
          [안내] 대학 자체 데이터만 수정 가능합니다.
        </p>
        <p className="mt-1 text-amber-900/90">
          정보공시 API를 통해 연동된 데이터는 원본 데이터의 정확성 유지를 위해
          조회 및 수정이 제한됩니다. 수정이 필요한 대학 자체 데이터를 검색 후
          진행해 주십시오.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="rc-year">연도</Label>
          {years.length > 0 ? (
            <select
              id="rc-year"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="rc-year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="예: 2025"
            />
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="rc-univ">대학코드</Label>
          <Input
            id="rc-univ"
            value={univCode}
            onChange={(e) => setUnivCode(e.target.value)}
            placeholder="선택"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rc-dept">학과코드</Label>
          <Input
            id="rc-dept"
            value={deptCode}
            onChange={(e) => setDeptCode(e.target.value)}
            placeholder="선택 (_ALL_)"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="rc-q">지표명 검색</Label>
          <div className="flex gap-2">
            <Input
              id="rc-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="지표명 일부"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void load(1);
              }}
            />
            <Button onClick={() => void load(1)} disabled={loading}>
              <Search className="mr-1 h-4 w-4" />
              조회
            </Button>
          </div>
        </div>
      </div>

      {(statusMsg || error) && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {statusMsg && (
            <span className="text-muted-foreground">{statusMsg}</span>
          )}
          {error && <span className="text-destructive">{error}</span>}
        </div>
      )}

      <div className="ag-theme-quartz h-[560px] w-full overflow-hidden rounded-md border">
        <AgGridReact<RawCorrectionItem>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(p) => String(p.data.rawId)}
          onCellValueChanged={onCellValueChanged}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          animateRows={false}
          overlayNoRowsTemplate={
            loading
              ? '조회 중…'
              : '조건에 맞는 대학 자체 데이터가 없습니다.'
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          페이지 {page} / {totalPages} (페이지당 {PAGE_SIZE}건)
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={loading || page <= 1}
            onClick={() => void load(page - 1)}
          >
            이전
          </Button>
          <Button
            variant="outline"
            disabled={loading || page >= totalPages}
            onClick={() => void load(page + 1)}
          >
            다음
          </Button>
        </div>
      </div>
    </div>
  );
}
