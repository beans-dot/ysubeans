'use client';

import { useEffect, useState } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  ArrowRight,
  Check,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  api,
  type InternalDeptNode,
  type InternalSeriesNode,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

const SERIES_DROPPABLE_ID = 'internal-series';
const SERIES_DRAG_PREFIX = 'series-';

function splitTree(nodes: InternalSeriesNode[]): {
  uncategorized: InternalSeriesNode | null;
  ordered: InternalSeriesNode[];
} {
  const uncategorized = nodes.find((s) => s.isUncategorized) ?? null;
  const ordered = nodes.filter((s) => !s.isUncategorized);
  return { uncategorized, ordered };
}

function moveDepts(
  prev: InternalSeriesNode[],
  deptPks: number[],
  destSeriesId: number,
  destIndex: number,
): InternalSeriesNode[] {
  const idSet = new Set(deptPks);
  const next = prev.map((s) => ({ ...s, departments: [...s.departments] }));
  const collected: InternalDeptNode[] = [];
  for (const series of next) {
    const remaining: InternalDeptNode[] = [];
    for (const d of series.departments) {
      if (idSet.has(d.deptPk)) collected.push(d);
      else remaining.push(d);
    }
    series.departments = remaining;
  }
  const order = new Map(deptPks.map((id, i) => [id, i]));
  collected.sort(
    (a, b) => (order.get(a.deptPk) ?? 0) - (order.get(b.deptPk) ?? 0),
  );
  const dst = next.find((s) => s.seriesId === destSeriesId);
  if (!dst) return prev;
  const insertAt = Math.min(Math.max(destIndex, 0), dst.departments.length);
  dst.departments.splice(insertAt, 0, ...collected);
  return next;
}

function reorderSeries(
  prev: InternalSeriesNode[],
  fromIndex: number,
  toIndex: number,
): InternalSeriesNode[] {
  const { uncategorized, ordered } = splitTree(prev);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ordered.length ||
    toIndex >= ordered.length ||
    fromIndex === toIndex
  ) {
    return prev;
  }
  const nextOrdered = ordered.map((s) => ({
    ...s,
    departments: [...s.departments],
  }));
  const [removed] = nextOrdered.splice(fromIndex, 1);
  nextOrdered.splice(toIndex, 0, removed);
  const withOrder = nextOrdered.map((s, index) => ({
    ...s,
    displayOrder: index,
  }));
  return uncategorized
    ? [{ ...uncategorized, departments: [...uncategorized.departments] }, ...withOrder]
    : withOrder;
}

export function InternalOrgManager() {
  const [tree, setTree] = useState<InternalSeriesNode[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSeries, setNewSeries] = useState('');
  const [newDeptBySeries, setNewDeptBySeries] = useState<Record<number, string>>(
    {},
  );
  const [editingSeriesId, setEditingSeriesId] = useState<number | null>(null);
  const [editingSeriesName, setEditingSeriesName] = useState('');
  const [editingDeptPk, setEditingDeptPk] = useState<number | null>(null);
  const [editingDeptName, setEditingDeptName] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [moveTargetId, setMoveTargetId] = useState('');

  const load = () => {
    api
      .get<InternalSeriesNode[]>('/internal-org/tree')
      .then(({ data }) => {
        setTree(data);
        setDirty(false);
        setSelectedIds(new Set());
        setMoveTargetId('');
      })
      .catch(() => setTree([]));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const series = tree.map((s, index) => ({
        seriesId: s.seriesId,
        displayOrder: s.isUncategorized ? -1 : index,
      }));
      const departments = tree.flatMap((s) =>
        s.departments.map((d, index) => ({
          deptPk: d.deptPk,
          seriesId: s.seriesId,
          displayOrder: index,
        })),
      );
      await api.put('/internal-org/reorder', { series, departments });
      setDirty(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleAddSeries = async () => {
    if (!newSeries.trim()) return;
    setBusy(true);
    try {
      await api.post('/internal-org/series', {
        seriesName: newSeries.trim(),
      });
      setNewSeries('');
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '계열 추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleRenameSeries = async (s: InternalSeriesNode) => {
    const name = editingSeriesName.trim();
    if (!name) {
      alert('계열 이름을 입력해 주세요.');
      return;
    }
    if (name === s.seriesName) {
      setEditingSeriesId(null);
      return;
    }
    setBusy(true);
    try {
      await api.put(`/internal-org/series/${s.seriesId}`, { seriesName: name });
      setEditingSeriesId(null);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '계열 이름 수정 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSeries = async (s: InternalSeriesNode) => {
    if (s.isUncategorized) return;
    const ok = window.confirm(
      `계열 「${s.seriesName}」을(를) 삭제할까요?\n소속 학과는 「미분류」로 이동됩니다. 학과 코드와 자체 데이터는 그대로 유지됩니다.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.delete(`/internal-org/series/${s.seriesId}`);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '계열 삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleAddDept = async (seriesId: number) => {
    const name = (newDeptBySeries[seriesId] ?? '').trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.post('/internal-org/departments', { seriesId, deptName: name });
      setNewDeptBySeries((prev) => ({ ...prev, [seriesId]: '' }));
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '학과 추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleRenameDept = async (d: InternalDeptNode) => {
    const name = editingDeptName.trim();
    if (!name) {
      alert('학과명을 입력해 주세요.');
      return;
    }
    if (name === d.deptName) {
      setEditingDeptPk(null);
      return;
    }
    setBusy(true);
    try {
      await api.put(`/internal-org/departments/${d.deptPk}`, { deptName: name });
      setEditingDeptPk(null);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '학과명 수정 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDept = async (d: InternalDeptNode) => {
    const extra =
      d.rawCount > 0
        ? `\n이 코드(${d.deptCode})로 저장된 자체 데이터가 ${d.rawCount}건 있습니다. 트리에서만 제거되며 데이터 행은 코드 기준으로 남습니다.`
        : '';
    const ok = window.confirm(
      `학과 「${d.deptName}」(${d.deptCode})을(를) 삭제할까요?${extra}`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.delete(`/internal-org/departments/${d.deptPk}`);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '학과 삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (deptPk: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(deptPk)) next.delete(deptPk);
      else next.add(deptPk);
      return next;
    });
  };

  const seriesSelectionState = (
    s: InternalSeriesNode,
  ): boolean | 'indeterminate' => {
    if (s.departments.length === 0) return false;
    const selectedCount = s.departments.filter((d) =>
      selectedIds.has(d.deptPk),
    ).length;
    if (selectedCount === 0) return false;
    if (selectedCount === s.departments.length) return true;
    return 'indeterminate';
  };

  const toggleSelectSeries = (s: InternalSeriesNode) => {
    const allSelected = s.departments.every((d) => selectedIds.has(d.deptPk));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const d of s.departments) {
        if (allSelected) next.delete(d.deptPk);
        else next.add(d.deptPk);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setMoveTargetId('');
  };

  const applyMove = (
    deptPks: number[],
    destSeriesId: number,
    destIndex: number,
  ) => {
    if (deptPks.length === 0) return;
    setTree((prev) => moveDepts(prev, deptPks, destSeriesId, destIndex));
    setDirty(true);
    clearSelection();
  };

  const handleBulkMove = () => {
    if (!moveTargetId || selectedIds.size === 0) return;
    const destSeriesId = Number(moveTargetId);
    const dest = tree.find((s) => s.seriesId === destSeriesId);
    if (!dest) return;
    applyMove([...selectedIds], destSeriesId, dest.departments.length);
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (type === 'SERIES') {
      setTree((prev) =>
        reorderSeries(prev, source.index, destination.index),
      );
      setDirty(true);
      return;
    }

    const destSeriesId = Number(destination.droppableId);
    const draggedId = Number(result.draggableId);

    const idsToMove =
      selectedIds.has(draggedId) && selectedIds.size > 1
        ? [...selectedIds]
        : [draggedId];

    let destIndex = destination.index;
    if (idsToMove.length > 1 && source.droppableId === destination.droppableId) {
      const src = tree.find((s) => String(s.seriesId) === source.droppableId);
      if (src) {
        const removedBefore = src.departments
          .slice(0, destination.index)
          .filter((d) => idsToMove.includes(d.deptPk)).length;
        destIndex = destination.index - removedBefore;
      }
    }

    applyMove(idsToMove, destSeriesId, destIndex);
  };

  const selectedCount = selectedIds.size;
  const { uncategorized, ordered } = splitTree(tree);

  const renderSeriesBody = (
    s: InternalSeriesNode,
    seriesDragHandleProps?: DraggableProvidedDragHandleProps | null,
  ) => {
    const seriesChecked = seriesSelectionState(s);

    return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {seriesDragHandleProps && (
            <span
              {...seriesDragHandleProps}
              className="flex shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
              title="계열 순서 변경"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )}
          <Checkbox
            checked={seriesChecked}
            disabled={s.departments.length === 0}
            onCheckedChange={() => toggleSelectSeries(s)}
            aria-label={`${s.seriesName} 전체 선택`}
          />
          {editingSeriesId === s.seriesId ? (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <Input
                value={editingSeriesName}
                onChange={(e) => setEditingSeriesName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleRenameSeries(s);
                  } else if (e.key === 'Escape') {
                    setEditingSeriesId(null);
                  }
                }}
                className="h-8"
                disabled={busy}
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                disabled={busy}
                onClick={() => void handleRenameSeries(s)}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={() => setEditingSeriesId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="min-w-0 text-sm font-bold">
              {s.seriesName}
              {s.isUncategorized && (
                <span className="ml-2 text-xs font-medium text-amber-800">
                  계열 미지정
                </span>
              )}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {s.departments.length}개 학과
              </span>
            </div>
          )}
        </div>
        {!s.isUncategorized && editingSeriesId !== s.seriesId && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              disabled={busy}
              onClick={() => {
                setEditingSeriesId(s.seriesId);
                setEditingSeriesName(s.seriesName);
              }}
              title="계열 이름 수정"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => void handleDeleteSeries(s)}
              title="계열 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <Droppable droppableId={String(s.seriesId)} type="DEPT">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[40px] space-y-1 rounded ${
              snapshot.isDraggingOver ? 'bg-primary/5' : ''
            }`}
          >
            {s.departments.map((d, index) => {
              const isSelected = selectedIds.has(d.deptPk);
              return (
              <Draggable
                key={d.deptPk}
                draggableId={String(d.deptPk)}
                index={index}
              >
                {(dragProvided) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className={`flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm ${
                      isSelected ? 'border-primary/40 bg-primary/5' : ''
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(d.deptPk)}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label={`${d.deptName} 선택`}
                    />
                    <span
                      {...dragProvided.dragHandleProps}
                      className="flex shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    {editingDeptPk === d.deptPk ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1">
                        <Input
                          value={editingDeptName}
                          onChange={(e) => setEditingDeptName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleRenameDept(d);
                            } else if (e.key === 'Escape') {
                              setEditingDeptPk(null);
                            }
                          }}
                          className="h-8"
                          disabled={busy}
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          disabled={busy}
                          onClick={() => void handleRenameDept(d)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => setEditingDeptPk(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate">
                          {d.deptName}
                        </span>
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {d.deptCode}
                        </Badge>
                        {d.rawCount > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            데이터 {d.rawCount}
                          </span>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          disabled={busy}
                          onClick={() => {
                            setEditingDeptPk(d.deptPk);
                            setEditingDeptName(d.deptName);
                          }}
                          title="학과명 수정"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => void handleDeleteDept(d)}
                          title="학과 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Draggable>
            );
            })}
            {provided.placeholder}
            {s.departments.length === 0 && (
              <div className="py-2 text-center text-xs text-muted-foreground">
                학과를 여기로 드래그하거나 아래에서 추가
              </div>
            )}
          </div>
        )}
      </Droppable>

      <div className="mt-2 flex gap-2">
        <Input
          placeholder="새 학과명"
          value={newDeptBySeries[s.seriesId] ?? ''}
          onChange={(e) =>
            setNewDeptBySeries((prev) => ({
              ...prev,
              [s.seriesId]: e.target.value,
            }))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAddDept(s.seriesId);
            }
          }}
          className="h-8"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !(newDeptBySeries[s.seriesId] ?? '').trim()}
          onClick={() => void handleAddDept(s.seriesId)}
        >
          <Plus className="mr-1 h-4 w-4" /> 학과 추가
        </Button>
      </div>
    </>
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>연성대학교 계열·학과</CardTitle>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? '저장 중...' : '작업 저장'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          학과별 자체 경쟁력 분석 지표(competitiveness)에서 쓰는 편제입니다.
          공시 데이터와 분리되어 있으며, 최초에는 공시 학과·코드를 복사해 둡니다.
          학과명은 바꿔도 코드는 그대로라 이미 올린 자체 데이터가 따라갑니다.
          신설 학과는 <span className="font-mono">INT-0001</span> 형식의 코드가
          자동 부여됩니다. 계열은 왼쪽 손잡이로 순서를 바꾸고, 학과는 드래그하거나
          체크박스로 일괄 이동한 뒤 「작업 저장」을 눌러 주세요.
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="새 계열 이름"
            value={newSeries}
            onChange={(e) => setNewSeries(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddSeries();
              }
            }}
            className="h-9"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !newSeries.trim()}
            onClick={() => void handleAddSeries()}
          >
            <Plus className="mr-1 h-4 w-4" /> 계열 추가
          </Button>
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-sm font-medium">
              {selectedCount}개 선택됨
            </span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={moveTargetId}
              onChange={(e) => setMoveTargetId(e.target.value)}
              aria-label="이동할 계열"
            >
              <option value="">이동할 계열 선택</option>
              {tree.map((s) => (
                <option key={s.seriesId} value={String(s.seriesId)}>
                  {s.seriesName}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleBulkMove}
              disabled={!moveTargetId}
            >
              <ArrowRight className="mr-1 h-4 w-4" /> 선택 이동
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="mr-1 h-4 w-4" /> 선택 해제
            </Button>
          </div>
        )}

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="space-y-4">
            {uncategorized && (
              <div className="rounded-md border border-amber-300 bg-amber-50/40 p-3">
                {renderSeriesBody(uncategorized)}
              </div>
            )}
            <Droppable droppableId={SERIES_DROPPABLE_ID} type="SERIES">
              {(catProvided, catSnapshot) => (
                <div
                  ref={catProvided.innerRef}
                  {...catProvided.droppableProps}
                  className={`space-y-4 rounded-md ${
                    catSnapshot.isDraggingOver ? 'bg-muted/40' : ''
                  }`}
                >
                  {ordered.map((s, index) => (
                    <Draggable
                      key={s.seriesId}
                      draggableId={`${SERIES_DRAG_PREFIX}${s.seriesId}`}
                      index={index}
                    >
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`rounded-md border p-3 ${
                            dragSnapshot.isDragging
                              ? 'border-primary/40 shadow-md'
                              : ''
                          }`}
                        >
                          {renderSeriesBody(s, dragProvided.dragHandleProps)}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {catProvided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </DragDropContext>
      </CardContent>
    </Card>
  );
}
