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
import { api, type CategoryTreeNode, type MetricNode } from '@/lib/api';
import { UNCATEGORIZED_CATEGORY_NAME } from '@/lib/metricConstants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CATEGORIES_DROPPABLE_ID = 'categories';
const CATEGORY_DRAG_PREFIX = 'category-';

function isUncategorized(cat: CategoryTreeNode): boolean {
  return cat.categoryName === UNCATEGORIZED_CATEGORY_NAME;
}

function sortTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (isUncategorized(a)) return -1;
    if (isUncategorized(b)) return 1;
    return a.displayOrder - b.displayOrder || a.categoryId - b.categoryId;
  });
}

function splitTree(nodes: CategoryTreeNode[]): {
  uncategorized: CategoryTreeNode | null;
  ordered: CategoryTreeNode[];
} {
  const uncategorized = nodes.find(isUncategorized) ?? null;
  const ordered = nodes.filter((c) => !isUncategorized(c));
  return { uncategorized, ordered };
}

function metricLabel(m: MetricNode): string {
  // metric_name 사용 (학과단위 지표는 뒤에 (학과별)이 붙음)
  return m.metricName;
}

function moveMetricsInTree(
  prev: CategoryTreeNode[],
  metricIds: number[],
  destCategoryId: number,
  destIndex: number,
): CategoryTreeNode[] {
  const idSet = new Set(metricIds);
  const next = prev.map((c) => ({ ...c, metrics: [...c.metrics] }));
  const collected: MetricNode[] = [];

  for (const cat of next) {
    const remaining: MetricNode[] = [];
    for (const m of cat.metrics) {
      if (idSet.has(m.metricId)) collected.push(m);
      else remaining.push(m);
    }
    cat.metrics = remaining;
  }

  // 원본 선택 순서 유지
  const order = new Map(metricIds.map((id, i) => [id, i]));
  collected.sort(
    (a, b) => (order.get(a.metricId) ?? 0) - (order.get(b.metricId) ?? 0),
  );

  const dstCat = next.find((c) => c.categoryId === destCategoryId);
  if (!dstCat) return prev;

  const insertAt = Math.min(Math.max(destIndex, 0), dstCat.metrics.length);
  dstCat.metrics.splice(insertAt, 0, ...collected);
  return next;
}

function reorderCategoriesInTree(
  prev: CategoryTreeNode[],
  fromIndex: number,
  toIndex: number,
): CategoryTreeNode[] {
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

  const nextOrdered = ordered.map((c) => ({ ...c, metrics: [...c.metrics] }));
  const [removed] = nextOrdered.splice(fromIndex, 1);
  nextOrdered.splice(toIndex, 0, removed);

  const withOrder = nextOrdered.map((c, index) => ({
    ...c,
    displayOrder: index,
  }));

  return uncategorized
    ? [{ ...uncategorized, metrics: [...uncategorized.metrics] }, ...withOrder]
    : withOrder;
}

function TreeBuilderPane({
  sourceType,
}: {
  sourceType: 'ALIMI' | 'INTERNAL';
}) {
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [dirty, setDirty] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [moveTargetId, setMoveTargetId] = useState('');

  const load = () => {
    api
      .get<CategoryTreeNode[]>('/metrics/tree', { params: { sourceType } })
      .then(({ data }) => {
        setTree(sortTree(data));
        setSelectedIds(new Set());
      })
      .catch(() => setTree([]));
  };

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener('ir-metrics-changed', onChanged);
    return () => window.removeEventListener('ir-metrics-changed', onChanged);
  }, [sourceType]);

  const toggleSelect = (metricId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(metricId)) next.delete(metricId);
      else next.add(metricId);
      return next;
    });
  };

  const categorySelectionState = (
    cat: CategoryTreeNode,
  ): boolean | 'indeterminate' => {
    if (cat.metrics.length === 0) return false;
    const selectedCount = cat.metrics.filter((m) =>
      selectedIds.has(m.metricId),
    ).length;
    if (selectedCount === 0) return false;
    if (selectedCount === cat.metrics.length) return true;
    return 'indeterminate';
  };

  const toggleSelectCategory = (cat: CategoryTreeNode) => {
    const allSelected = cat.metrics.every((m) => selectedIds.has(m.metricId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const m of cat.metrics) {
        if (allSelected) next.delete(m.metricId);
        else next.add(m.metricId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setMoveTargetId('');
  };

  const applyMove = (
    metricIds: number[],
    destCategoryId: number,
    destIndex: number,
  ) => {
    if (metricIds.length === 0) return;
    setTree((prev) =>
      moveMetricsInTree(prev, metricIds, destCategoryId, destIndex),
    );
    setDirty(true);
    clearSelection();
  };

  const handleBulkMove = () => {
    if (!moveTargetId || selectedIds.size === 0) return;
    const destCategoryId = Number(moveTargetId);
    const destCat = tree.find((c) => c.categoryId === destCategoryId);
    if (!destCat) return;
    applyMove([...selectedIds], destCategoryId, destCat.metrics.length);
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (type === 'CATEGORY') {
      setTree((prev) =>
        reorderCategoriesInTree(prev, source.index, destination.index),
      );
      setDirty(true);
      return;
    }

    const draggedId = Number(draggableId);
    const destCategoryId = Number(destination.droppableId);

    // 선택된 항목을 드래그하면 선택 전체를 함께 이동
    const idsToMove =
      selectedIds.has(draggedId) && selectedIds.size > 1
        ? [...selectedIds]
        : [draggedId];

    let destIndex = destination.index;
    if (idsToMove.length > 1 && source.droppableId === destination.droppableId) {
      // 같은 카테고리 내 다중 이동: 앞에 있던 선택 항목이 빠지면 삽입 인덱스 보정
      const srcCat = tree.find((c) => String(c.categoryId) === source.droppableId);
      if (srcCat) {
        const removedBefore = srcCat.metrics
          .slice(0, destination.index)
          .filter((m) => idsToMove.includes(m.metricId)).length;
        destIndex = destination.index - removedBefore;
      }
    }

    applyMove(idsToMove, destCategoryId, destIndex);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const metrics = tree.flatMap((cat) =>
        cat.metrics.map((m: MetricNode, index) => ({
          metricId: m.metricId,
          categoryId: cat.categoryId,
          displayOrder: index,
        })),
      );
      const categories = tree.map((c, index) => ({
        categoryId: c.categoryId,
        displayOrder: isUncategorized(c) ? -1 : index,
      }));
      await api.put('/metrics/reorder', { categories, metrics });
      setDirty(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    if (newCategory.trim() === UNCATEGORIZED_CATEGORY_NAME) {
      alert(`「${UNCATEGORIZED_CATEGORY_NAME}」은 시스템 카테고리입니다.`);
      return;
    }
    await api.post('/metrics/categories', {
      categoryName: newCategory.trim(),
      displayOrder: tree.length + 1,
      sourceType,
    });
    setNewCategory('');
    load();
  };

  const startRenameCategory = (cat: CategoryTreeNode) => {
    if (isUncategorized(cat)) return;
    setEditingId(cat.categoryId);
    setEditingName(cat.categoryName);
  };

  const cancelRenameCategory = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleRenameCategory = async (cat: CategoryTreeNode) => {
    const name = editingName.trim();
    if (!name) {
      alert('카테고리 이름을 입력해 주세요.');
      return;
    }
    if (name === UNCATEGORIZED_CATEGORY_NAME) {
      alert(`「${UNCATEGORIZED_CATEGORY_NAME}」은 시스템 카테고리입니다.`);
      return;
    }
    if (name === cat.categoryName) {
      cancelRenameCategory();
      return;
    }
    setRenaming(true);
    try {
      await api.put(`/metrics/categories/${cat.categoryId}`, {
        categoryName: name,
      });
      cancelRenameCategory();
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '카테고리 이름 수정 실패');
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteCategory = async (cat: CategoryTreeNode) => {
    if (isUncategorized(cat)) return;
    const ok = window.confirm(
      `카테고리 「${cat.categoryName}」을(를) 삭제할까요?\n소속 지표는 「${UNCATEGORIZED_CATEGORY_NAME}」으로 이동됩니다.`,
    );
    if (!ok) return;
    setDeletingId(cat.categoryId);
    try {
      await api.delete(`/metrics/categories/${cat.categoryId}`);
      setDirty(false);
      cancelRenameCategory();
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '카테고리 삭제 실패');
    } finally {
      setDeletingId(null);
    }
  };

  const selectedCount = selectedIds.size;
  const { uncategorized, ordered } = splitTree(tree);

  const renderCategoryBody = (
    cat: CategoryTreeNode,
    categoryDragHandleProps?: DraggableProvidedDragHandleProps | null,
  ) => {
    const uncategorizedCat = isUncategorized(cat);
    const catChecked = categorySelectionState(cat);

    return (
      <>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {categoryDragHandleProps && (
              <span
                {...categoryDragHandleProps}
                className="flex shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                title="분류 순서 변경"
                aria-label={`${cat.categoryName} 순서 변경`}
              >
                <GripVertical className="h-4 w-4" />
              </span>
            )}
            <Checkbox
              checked={catChecked}
              disabled={cat.metrics.length === 0}
              onCheckedChange={() => toggleSelectCategory(cat)}
              aria-label={`${cat.categoryName} 전체 선택`}
            />
            {editingId === cat.categoryId ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleRenameCategory(cat);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRenameCategory();
                    }
                  }}
                  className="h-8"
                  disabled={renaming}
                  autoFocus
                  aria-label="카테고리 이름 수정"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  disabled={renaming}
                  onClick={() => void handleRenameCategory(cat)}
                  title="이름 저장"
                  aria-label="이름 저장"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  disabled={renaming}
                  onClick={cancelRenameCategory}
                  title="수정 취소"
                  aria-label="수정 취소"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="min-w-0 text-sm font-bold">
                {cat.categoryName}
                {uncategorizedCat && (
                  <span className="ml-2 text-xs font-medium text-amber-800">
                    엑셀 업로드 대기 분류
                  </span>
                )}
                {cat.metrics.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {cat.metrics.length}개
                  </span>
                )}
              </div>
            )}
          </div>
          {!uncategorizedCat && editingId !== cat.categoryId && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                disabled={renaming || deletingId != null}
                onClick={() => startRenameCategory(cat)}
                title="카테고리 이름 수정"
                aria-label="카테고리 이름 수정"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-destructive hover:text-destructive"
                disabled={deletingId === cat.categoryId}
                onClick={() => handleDeleteCategory(cat)}
                title="카테고리 삭제"
                aria-label="카테고리 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <Droppable droppableId={String(cat.categoryId)} type="METRIC">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[40px] space-y-1 rounded ${
                snapshot.isDraggingOver ? 'bg-primary/5' : ''
              }`}
            >
              {cat.metrics.map((m, index) => {
                const isSelected = selectedIds.has(m.metricId);
                return (
                  <Draggable
                    key={m.metricId}
                    draggableId={String(m.metricId)}
                    index={index}
                  >
                    {(dragProvided) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm ${
                          isSelected
                            ? 'border-primary/40 bg-primary/5'
                            : ''
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(m.metricId)}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          aria-label={`${metricLabel(m)} 선택`}
                        />
                        <span
                          {...dragProvided.dragHandleProps}
                          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
                        >
                          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-mono text-[13px]">
                            {metricLabel(m)}
                          </span>
                        </span>
                        <Badge
                          variant={
                            m.sourceType === 'ALIMI' ? 'alimi' : 'internal'
                          }
                        >
                          {m.sourceType === 'ALIMI' ? '공시' : '자체'}
                        </Badge>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
              {cat.metrics.length === 0 && (
                <div className="py-2 text-center text-xs text-muted-foreground">
                  지표를 여기로 드래그
                </div>
              )}
            </div>
          )}
        </Droppable>
      </>
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>
          {sourceType === 'ALIMI' ? '대학정보공시' : '대학자체데이터'}
        </CardTitle>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? '저장 중...' : '작업 저장'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {sourceType === 'ALIMI'
            ? '대학정보공시(알리미) 지표만 표시됩니다. dashboard 조회 대상이며, 분류 왼쪽 손잡이로 순서를 바꾸고 지표는 드래그하거나 체크박스로 일괄 이동한 뒤 「작업 저장」을 눌러 주세요.'
            : `엑셀로 등록된 신규 자체 지표는 최상단 「${UNCATEGORIZED_CATEGORY_NAME}」에 모입니다. competitiveness 조회 대상이며, 분류 왼쪽 손잡이로 순서를 바꾸고 지표는 드래그하거나 체크박스로 일괄 이동한 뒤 「작업 저장」을 눌러 주세요. 자체 지표명은 업로드한 metric_name으로 표시됩니다.`}
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="새 카테고리 이름"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="h-9"
          />
          <Button size="sm" variant="outline" onClick={handleAddCategory}>
            <Plus className="mr-1 h-4 w-4" /> 카테고리 추가
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
              aria-label="이동할 카테고리"
            >
              <option value="">이동할 카테고리 선택</option>
              {tree.map((cat) => (
                <option key={cat.categoryId} value={String(cat.categoryId)}>
                  {cat.categoryName}
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
                {renderCategoryBody(uncategorized)}
              </div>
            )}

            <Droppable droppableId={CATEGORIES_DROPPABLE_ID} type="CATEGORY">
              {(catProvided, catSnapshot) => (
                <div
                  ref={catProvided.innerRef}
                  {...catProvided.droppableProps}
                  className={`space-y-4 rounded-md ${
                    catSnapshot.isDraggingOver ? 'bg-muted/40' : ''
                  }`}
                >
                  {ordered.map((cat, index) => (
                    <Draggable
                      key={cat.categoryId}
                      draggableId={`${CATEGORY_DRAG_PREFIX}${cat.categoryId}`}
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
                          {renderCategoryBody(
                            cat,
                            dragProvided.dragHandleProps,
                          )}
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

export function TreeBuilder() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">지표 트리 빌더</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          대학정보공시 데이터는 dashboard에서, 대학자체데이터는 competitiveness에서
          조회됩니다. 구성은 동일하지만 지표 출처가 분리되어 있습니다.
        </p>
      </div>
      <Tabs defaultValue="ALIMI">
        <TabsList>
          <TabsTrigger value="ALIMI">대학정보공시</TabsTrigger>
          <TabsTrigger value="INTERNAL">대학자체데이터</TabsTrigger>
        </TabsList>
        <TabsContent value="ALIMI">
          <TreeBuilderPane sourceType="ALIMI" />
        </TabsContent>
        <TabsContent value="INTERNAL">
          <TreeBuilderPane sourceType="INTERNAL" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
