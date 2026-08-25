'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type SelectionChangedEvent,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { Search, Trash2 } from 'lucide-react';
import {
  deleteRawCorrection,
  fetchRawCorrectionList,
  fetchRawCorrectionYears,
  patchRawCorrectionValue,
  type RawCorrectionItem,
  type RawCorrectionSourceType,
} from '@/lib/api';
import { notifyAutoSaved } from '@/components/admin/AutoSaveToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

ModuleRegistry.registerModules([AllCommunityModule]);

const PAGE_SIZE = 100;

function sourceLabel(sourceType: RawCorrectionSourceType) {
  return sourceType === 'MONITORING'
    ? '대학주요모니터링 데이터'
    : '대학 자체 데이터';
}

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

function RawDataCorrectionPane({
  sourceType,
}: {
  sourceType: RawCorrectionSourceType;
}) {
  const label = sourceLabel(sourceType);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<string>('');
  const [univCode, setUnivCode] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<RawCorrectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savingIds = useRef(new Set<number>());
  const gridApiRef = useRef<GridApi<RawCorrectionItem> | null>(null);

  useEffect(() => {
    fetchRawCorrectionYears(sourceType)
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
  }, [sourceType]);

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
          sourceType,
          univCode: univCode.trim() || undefined,
          deptCode: deptCode.trim() || undefined,
          q: q.trim() || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        });
        setRows(data.items);
        setTotal(data.total);
        setPage(nextPage);
        setSelectedCount(0);
        gridApiRef.current?.deselectAll();
        setStatusMsg(
          `${data.total.toLocaleString()}건 중 ${data.items.length}건 표시`,
        );
      } catch (err) {
        setRows([]);
        setTotal(0);
        setSelectedCount(0);
        setError(apiErrorMessage(err, `${label} 조회에 실패했습니다.`));
      } finally {
        setLoading(false);
      }
    },
    [year, sourceType, univCode, deptCode, q, label],
  );

  useEffect(() => {
    if (!year) return;
    void load(1);
    // 초기 연도 로드 시에만 자동 조회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, sourceType]);

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
        width: 110,
        editable: false,
      },
      {
        field: 'univName',
        headerName: '대학명',
        width: 160,
        editable: false,
      },
      {
        field: 'deptCode',
        headerName: '학과코드',
        width: 110,
        editable: false,
      },
      {
        field: 'deptName',
        headerName: '학과명',
        width: 180,
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

  const rowSelection = useMemo(
    () => ({
      mode: 'multiRow' as const,
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: false,
    }),
    [],
  );

  const onSelectionChanged = useCallback(
    (event: SelectionChangedEvent<RawCorrectionItem>) => {
      setSelectedCount(event.api.getSelectedRows().length);
    },
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
        setStatusMsg(null);
        notifyAutoSaved();
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

  const handleDelete = useCallback(async () => {
    const api = gridApiRef.current;
    if (!api) return;

    const selected = api.getSelectedRows();
    if (selected.length === 0) return;

    const ok = window.confirm(
      `선택한 ${selected.length}건을 DB에서 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`,
    );
    if (!ok) return;

    setDeleting(true);
    setError(null);
    setStatusMsg(`${selected.length}건 삭제 중…`);
    try {
      const result = await deleteRawCorrection(selected.map((r) => r.rawId));
      setStatusMsg(`${result.deleted}건을 삭제했습니다.`);
      const remainingOnPage = rows.length - result.deleted;
      const nextPage =
        remainingOnPage <= 0 && page > 1 ? page - 1 : page;
      await load(nextPage);
    } catch (err) {
      setError(apiErrorMessage(err, '삭제에 실패했습니다.'));
      setStatusMsg(null);
    } finally {
      setDeleting(false);
    }
  }, [load, page, rows.length]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor={`rc-year-${sourceType}`}>연도</Label>
          {years.length > 0 ? (
            <select
              id={`rc-year-${sourceType}`}
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
              id={`rc-year-${sourceType}`}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="예: 2025"
            />
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rc-univ-${sourceType}`}>대학코드</Label>
          <Input
            id={`rc-univ-${sourceType}`}
            value={univCode}
            onChange={(e) => setUnivCode(e.target.value)}
            placeholder="선택"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rc-dept-${sourceType}`}>학과코드</Label>
          <Input
            id={`rc-dept-${sourceType}`}
            value={deptCode}
            onChange={(e) => setDeptCode(e.target.value)}
            placeholder="선택 (_ALL_)"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor={`rc-q-${sourceType}`}>지표명 검색</Label>
          <div className="flex gap-2">
            <Input
              id={`rc-q-${sourceType}`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="지표명 일부"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void load(1);
              }}
            />
            <Button onClick={() => void load(1)} disabled={loading || deleting}>
              <Search className="mr-1 h-4 w-4" />
              조회
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {statusMsg && (
            <span className="text-muted-foreground">{statusMsg}</span>
          )}
          {error && <span className="text-destructive">{error}</span>}
          {selectedCount > 0 && (
            <span className="font-medium text-foreground">
              {selectedCount}건 선택됨
            </span>
          )}
        </div>
        <Button
          variant="destructive"
          disabled={loading || deleting || selectedCount === 0}
          onClick={() => void handleDelete()}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          {deleting ? '삭제 중…' : '선택 삭제'}
        </Button>
      </div>

      <div className="ag-theme-quartz h-[560px] w-full overflow-hidden rounded-md border">
        <AgGridReact<RawCorrectionItem>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowSelection={rowSelection}
          getRowId={(p) => String(p.data.rawId)}
          onGridReady={(e) => {
            gridApiRef.current = e.api;
          }}
          onSelectionChanged={onSelectionChanged}
          onCellValueChanged={onCellValueChanged}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          animateRows={false}
          overlayNoRowsTemplate={
            loading
              ? '조회 중…'
              : `조건에 맞는 ${label}가 없습니다.`
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
            disabled={loading || deleting || page <= 1}
            onClick={() => void load(page - 1)}
          >
            이전
          </Button>
          <Button
            variant="outline"
            disabled={loading || deleting || page >= totalPages}
            onClick={() => void load(page + 1)}
          >
            다음
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RawDataCorrection() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">
          [안내] 대학자체데이터와 대학주요모니터링 데이터를 수정·삭제할 수 있습니다.
        </p>
        <p className="mt-1 text-amber-900/90">
          정보공시 API를 통해 연동된 데이터는 원본 데이터의 정확성 유지를 위해
          조회 및 수정이 제한됩니다. 구분 탭에서 대상을 선택한 뒤 검색·수정해
          주십시오.
        </p>
      </div>

      <Tabs defaultValue="INTERNAL">
        <TabsList>
          <TabsTrigger value="INTERNAL">대학자체데이터</TabsTrigger>
          <TabsTrigger value="MONITORING">대학주요모니터링</TabsTrigger>
        </TabsList>
        <TabsContent value="INTERNAL">
          <RawDataCorrectionPane sourceType="INTERNAL" />
        </TabsContent>
        <TabsContent value="MONITORING">
          <RawDataCorrectionPane sourceType="MONITORING" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
