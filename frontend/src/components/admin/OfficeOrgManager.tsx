'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

export interface OfficeNode {
  deptId: number;
  officeCode: string | null;
  deptName: string;
  isCategory: boolean;
  parentId: number | null;
  displayOrder: number;
  children: OfficeNode[];
}

const UNCAT_DROPPABLE_ID = 'office-uncat';
const CATEGORY_LIST_ID = 'office-categories';
const CATEGORY_DRAG_PREFIX = 'officecat-';

function moveOffices(
  categories: OfficeNode[],
  uncategorized: OfficeNode[],
  ids: number[],
  destParentId: number | null,
  destIndex: number,
): { categories: OfficeNode[]; uncategorized: OfficeNode[] } {
  const idSet = new Set(ids);
  const nextCats = categories.map((c) => ({
    ...c,
    children: [...c.children],
  }));
  let nextUncat = [...uncategorized];
  const collected: OfficeNode[] = [];

  nextUncat = nextUncat.filter((o) => {
    if (idSet.has(o.deptId)) {
      collected.push(o);
      return false;
    }
    return true;
  });
  for (const cat of nextCats) {
    cat.children = cat.children.filter((o) => {
      if (idSet.has(o.deptId)) {
        collected.push(o);
        return false;
      }
      return true;
    });
  }

  const order = new Map(ids.map((id, i) => [id, i]));
  collected.sort(
    (a, b) => (order.get(a.deptId) ?? 0) - (order.get(b.deptId) ?? 0),
  );
  const relocated = collected.map((o) => ({
    ...o,
    parentId: destParentId,
  }));

  if (destParentId == null) {
    const insertAt = Math.min(Math.max(destIndex, 0), nextUncat.length);
    nextUncat.splice(insertAt, 0, ...relocated);
  } else {
    const dst = nextCats.find((c) => c.deptId === destParentId);
    if (!dst) {
      return { categories, uncategorized };
    }
    const insertAt = Math.min(Math.max(destIndex, 0), dst.children.length);
    dst.children.splice(insertAt, 0, ...relocated);
  }
  return { categories: nextCats, uncategorized: nextUncat };
}

function reorderCategories(
  categories: OfficeNode[],
  fromIndex: number,
  toIndex: number,
): OfficeNode[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= categories.length ||
    toIndex >= categories.length ||
    fromIndex === toIndex
  ) {
    return categories;
  }
  const next = categories.map((c) => ({ ...c, children: [...c.children] }));
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next.map((c, index) => ({ ...c, displayOrder: index }));
}

export function OfficeOrgManager({
  year,
  onChanged,
}: {
  year: number;
  onChanged?: () => void;
}) {
  const [categories, setCategories] = useState<OfficeNode[]>([]);
  const [uncategorized, setUncategorized] = useState<OfficeNode[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newOfficeByParent, setNewOfficeByParent] = useState<
    Record<string, string>
  >({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [moveTargetId, setMoveTargetId] = useState('');

  const load = () => {
    api
      .get<{ categories: OfficeNode[]; uncategorized: OfficeNode[] }>(
        '/internal-org/offices',
        { params: { year } },
      )
      .then(({ data }) => {
        setCategories(data.categories);
        setUncategorized(data.uncategorized);
        setDirty(false);
        setSelectedIds(new Set());
        setMoveTargetId('');
      })
      .catch(() => {
        setCategories([]);
        setUncategorized([]);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const notify = () => onChanged?.();

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = [
        ...categories.map((c, index) => ({
          deptId: c.deptId,
          parentId: null as number | null,
          displayOrder: index,
        })),
        ...categories.flatMap((c) =>
          c.children.map((child, index) => ({
            deptId: child.deptId,
            parentId: c.deptId,
            displayOrder: index,
          })),
        ),
        ...uncategorized.map((o, index) => ({
          deptId: o.deptId,
          parentId: null as number | null,
          displayOrder: index,
        })),
      ];
      await api.put('/internal-org/offices/reorder', { year, items });
      setDirty(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    setBusy(true);
    try {
      await api.post('/internal-org/offices', {
        deptName: newCategory.trim(),
        year,
        isCategory: true,
      });
      setNewCategory('');
      load();
      notify();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '대분류 추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleAddOffice = async (parentId: number | null) => {
    const key = String(parentId ?? 'none');
    const name = (newOfficeByParent[key] ?? '').trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.post('/internal-org/offices', {
        deptName: name,
        year,
        isCategory: false,
        parentId,
      });
      setNewOfficeByParent((prev) => ({ ...prev, [key]: '' }));
      load();
      notify();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '부서 추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (node: OfficeNode) => {
    const name = editingName.trim();
    if (!name) {
      alert('이름을 입력해 주세요.');
      return;
    }
    if (name === node.deptName) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      await api.put(`/internal-org/offices/${node.deptId}`, {
        deptName: name,
        year,
      });
      setEditingId(null);
      load();
      notify();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '이름 수정 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleAbolish = async (node: OfficeNode) => {
    const kind = node.isCategory ? '대분류' : '부서';
    const ok = window.confirm(
      `${year}학년도부터 「${node.deptName}」 ${kind}을(를) 폐지할까요?\n이전 학년도 조회는 그대로 유지됩니다.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.delete(`/internal-org/offices/${node.deptId}`, {
        params: { year },
      });
      load();
      notify();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? '폐지 실패');
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (deptId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  const officesOf = (parentId: number | null) =>
    parentId == null
      ? uncategorized
      : (categories.find((c) => c.deptId === parentId)?.children ?? []);

  const selectionState = (offices: OfficeNode[]): boolean | 'indeterminate' => {
    if (offices.length === 0) return false;
    const selectedCount = offices.filter((o) => selectedIds.has(o.deptId)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === offices.length) return true;
    return 'indeterminate';
  };

  const toggleSelectGroup = (offices: OfficeNode[]) => {
    const allSelected = offices.every((o) => selectedIds.has(o.deptId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const o of offices) {
        if (allSelected) next.delete(o.deptId);
        else next.add(o.deptId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setMoveTargetId('');
  };

  const applyMove = (
    ids: number[],
    destParentId: number | null,
    destIndex: number,
  ) => {
    if (ids.length === 0) return;
    const next = moveOffices(
      categories,
      uncategorized,
      ids,
      destParentId,
      destIndex,
    );
    setCategories(next.categories);
    setUncategorized(next.uncategorized);
    setDirty(true);
    clearSelection();
  };

  const handleBulkMove = () => {
    if (moveTargetId === '' || selectedIds.size === 0) return;
    const destParentId =
      moveTargetId === UNCAT_DROPPABLE_ID ? null : Number(moveTargetId);
    const destOffices = officesOf(destParentId);
    applyMove([...selectedIds], destParentId, destOffices.length);
  };

  const parseDroppable = (droppableId: string): number | null => {
    if (droppableId === UNCAT_DROPPABLE_ID) return null;
    return Number(droppableId);
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

    if (type === 'CATEGORY') {
      setCategories((prev) =>
        reorderCategories(prev, source.index, destination.index),
      );
      setDirty(true);
      return;
    }

    const destParentId = parseDroppable(destination.droppableId);
    const draggedId = Number(result.draggableId);
    const idsToMove =
      selectedIds.has(draggedId) && selectedIds.size > 1
        ? [...selectedIds]
        : [draggedId];

    let destIndex = destination.index;
    if (
      idsToMove.length > 1 &&
      source.droppableId === destination.droppableId
    ) {
      const srcOffices = officesOf(parseDroppable(source.droppableId));
      const removedBefore = srcOffices
        .slice(0, destination.index)
        .filter((o) => idsToMove.includes(o.deptId)).length;
      destIndex = destination.index - removedBefore;
    }

    applyMove(idsToMove, destParentId, destIndex);
  };

  const selectedCount = selectedIds.size;
  const moveTargets: Array<{ id: string; label: string }> = [
    { id: UNCAT_DROPPABLE_ID, label: '미분류' },
    ...categories.map((c) => ({ id: String(c.deptId), label: c.deptName })),
  ];

  const renderOfficeRow = (node: OfficeNode, index: number) => {
    const isSelected = selectedIds.has(node.deptId);
    return (
      <Draggable
        key={node.deptId}
        draggableId={String(node.deptId)}
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
              onCheckedChange={() => toggleSelect(node.deptId)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`${node.deptName} 선택`}
            />
            <span
              {...dragProvided.dragHandleProps}
              className="flex shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            {editingId === node.deptId ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleRename(node);
                    } else if (e.key === 'Escape') {
                      setEditingId(null);
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
                  onClick={() => void handleRename(node)}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate">{node.deptName}</span>
                {node.officeCode && (
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {node.officeCode}
                  </Badge>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(node.deptId);
                    setEditingName(node.deptName);
                  }}
                  title="이름 수정"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => void handleAbolish(node)}
                  title="폐지"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  const renderBox = (
    title: string,
    parentId: number | null,
    offices: OfficeNode[],
    extra?: ReactNode,
    highlight?: boolean,
    categoryDragHandleProps?: DraggableProvidedDragHandleProps | null,
  ) => {
    const key = String(parentId ?? 'none');
    const droppableId =
      parentId == null ? UNCAT_DROPPABLE_ID : String(parentId);
    const groupChecked = selectionState(offices);

    return (
      <div
        className={`rounded-md border p-3 ${
          highlight ? 'border-amber-300 bg-amber-50/40' : ''
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {categoryDragHandleProps && (
              <span
                {...categoryDragHandleProps}
                className="flex shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                title="대분류 순서 변경"
              >
                <GripVertical className="h-4 w-4" />
              </span>
            )}
            <Checkbox
              checked={groupChecked}
              disabled={offices.length === 0}
              onCheckedChange={() => toggleSelectGroup(offices)}
              aria-label={`${title} 전체 선택`}
            />
            {editingId === parentId && parentId != null ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const cat = categories.find((c) => c.deptId === parentId);
                      if (cat) void handleRename(cat);
                    } else if (e.key === 'Escape') {
                      setEditingId(null);
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
                  onClick={() => {
                    const cat = categories.find((c) => c.deptId === parentId);
                    if (cat) void handleRename(cat);
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="min-w-0 text-sm font-bold">
                {title}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {offices.length}개 부서
                </span>
              </div>
            )}
          </div>
          {extra}
        </div>
        <Droppable droppableId={droppableId} type="OFFICE">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[40px] space-y-1 rounded ${
                snapshot.isDraggingOver ? 'bg-primary/5' : ''
              }`}
            >
              {offices.map((o, index) => renderOfficeRow(o, index))}
              {provided.placeholder}
              {offices.length === 0 && (
                <div className="py-2 text-center text-xs text-muted-foreground">
                  부서를 여기로 드래그하거나 아래에서 추가. 대분류는 조회
                  대상이 아닙니다.
                </div>
              )}
            </div>
          )}
        </Droppable>
        <div className="mt-2 flex gap-2">
          <Input
            placeholder="새 부서명"
            value={newOfficeByParent[key] ?? ''}
            onChange={(e) =>
              setNewOfficeByParent((prev) => ({
                ...prev,
                [key]: e.target.value,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddOffice(parentId);
              }
            }}
            className="h-8"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !(newOfficeByParent[key] ?? '').trim()}
            onClick={() => void handleAddOffice(parentId)}
          >
            <Plus className="mr-1 h-4 w-4" /> 부서 추가
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>행정부서</CardTitle>
        <Button size="sm" onClick={() => void handleSave()} disabled={!dirty || saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? '저장 중...' : '작업 저장'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          대분류는 그룹 헤더로만 쓰이며 책임부서·조회 대상이 될 수 없습니다.
          부서는 드래그하거나 체크박스로 일괄 이동한 뒤 「작업 저장」을 눌러
          주세요. 부서 코드는 이름 변경·폐지와 관계없이 유지됩니다.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="새 대분류 이름"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddCategory();
              }
            }}
            className="h-9"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !newCategory.trim()}
            onClick={() => void handleAddCategory()}
          >
            <Plus className="mr-1 h-4 w-4" /> 대분류 추가
          </Button>
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-sm font-medium">{selectedCount}개 선택됨</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={moveTargetId}
              onChange={(e) => setMoveTargetId(e.target.value)}
              aria-label="이동할 대분류"
            >
              <option value="">이동할 대분류 선택</option>
              {moveTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={handleBulkMove} disabled={!moveTargetId}>
              <ArrowRight className="mr-1 h-4 w-4" /> 선택 이동
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="mr-1 h-4 w-4" /> 선택 해제
            </Button>
          </div>
        )}

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="space-y-4">
            {renderBox('미분류', null, uncategorized, undefined, true)}
            <Droppable droppableId={CATEGORY_LIST_ID} type="CATEGORY">
              {(catProvided, catSnapshot) => (
                <div
                  ref={catProvided.innerRef}
                  {...catProvided.droppableProps}
                  className={`grid grid-cols-1 gap-4 rounded-md lg:grid-cols-2 ${
                    catSnapshot.isDraggingOver ? 'bg-muted/40' : ''
                  }`}
                >
                  {categories.map((cat, index) => (
                    <Draggable
                      key={cat.deptId}
                      draggableId={`${CATEGORY_DRAG_PREFIX}${cat.deptId}`}
                      index={index}
                    >
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={
                            dragSnapshot.isDragging
                              ? 'rounded-md border-primary/40 shadow-md'
                              : ''
                          }
                        >
                          {renderBox(
                            cat.deptName,
                            cat.deptId,
                            cat.children,
                            editingId === cat.deptId ? undefined : (
                              <div className="flex shrink-0 items-center gap-0.5">
                                {cat.officeCode && (
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[11px]"
                                  >
                                    {cat.officeCode}
                                  </Badge>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditingId(cat.deptId);
                                    setEditingName(cat.deptName);
                                  }}
                                  title="대분류 이름 수정"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-destructive hover:text-destructive"
                                  disabled={busy}
                                  onClick={() => void handleAbolish(cat)}
                                  title="대분류 폐지"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ),
                            false,
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
