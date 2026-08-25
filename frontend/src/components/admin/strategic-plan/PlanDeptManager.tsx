'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createSpDepartment,
  deleteSpDepartment,
  fetchSpDepartments,
  updateSpDepartment,
} from '@/lib/strategic-plan/api';
import { apiMessage } from '@/lib/strategic-plan/apiError';
import type { SpDepartment } from '@/lib/strategic-plan/types';

export function PlanDeptManager({
  reload,
}: {
  reload?: () => Promise<void>;
}) {
  const [items, setItems] = useState<SpDepartment[]>([]);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchSpDepartments()
      .then(setItems)
      .catch(() => setItems([]));
  };

  useEffect(load, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createSpDepartment(name);
      setNewName('');
      load();
    } catch (e) {
      alert(apiMessage(e, '부서 추가 실패'));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (dept: SpDepartment, name: string) => {
    if (name.trim() === dept.deptName) return;
    setBusy(true);
    try {
      await updateSpDepartment(dept.deptId, { deptName: name.trim() });
      load();
      await reload?.();
    } catch (e) {
      alert(apiMessage(e, '부서명 수정 실패'));
      load();
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setBusy(true);
    try {
      await Promise.all([
        updateSpDepartment(items[index].deptId, { displayOrder: target }),
        updateSpDepartment(items[target].deptId, { displayOrder: index }),
      ]);
      load();
    } catch (e) {
      alert(apiMessage(e, '순서 변경 실패'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (dept: SpDepartment) => {
    const ok = window.confirm(
      `부서 「${dept.deptName}」을(를) 삭제할까요?\n전략체계에서 이 부서가 책임·연관부서로 지정된 곳은 비워집니다.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteSpDepartment(dept.deptId);
      load();
      await reload?.();
    } catch (e) {
      alert(apiMessage(e, '부서 삭제 실패'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>부서 관리</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          전략체계에서 실행과제의 책임부서·연관부서를 고를 때 쓰는 목록입니다.
          이름을 바꾸면 이미 지정된 실행과제에도 바로 반영되고, 삭제하면 해당
          지정은 비워집니다.
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="새 부서명"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAdd();
              }
            }}
            className="h-9 max-w-xs"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !newName.trim()}
            onClick={() => void handleAdd()}
          >
            <Plus className="mr-1 h-4 w-4" /> 부서 추가
          </Button>
        </div>

        <div className="divide-y rounded-md border">
          {items.map((dept, index) => (
            <div
              key={`${dept.deptId}-${dept.deptName}`}
              className="flex flex-wrap items-center gap-2 px-3 py-2"
            >
              <Input
                defaultValue={dept.deptName}
                disabled={busy}
                onBlur={(e) => void handleRename(dept, e.target.value)}
                className="h-8 max-w-xs"
                aria-label={`${dept.deptName} 이름`}
              />
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  disabled={busy || index === 0}
                  onClick={() => void handleMove(index, -1)}
                  title="위로"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  disabled={busy || index === items.length - 1}
                  onClick={() => void handleMove(index, 1)}
                  title="아래로"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => void handleDelete(dept)}
                  title="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              등록된 부서가 없습니다. 위에서 추가하거나, 기존 실행과제에 적힌
              부서명이 있으면 목록을 열 때 자동으로 가져옵니다.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
