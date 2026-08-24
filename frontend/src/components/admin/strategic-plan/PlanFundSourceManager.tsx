'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  createSpFundSource,
  deleteSpFundSource,
  fetchSpFundSources,
  updateSpFundSource,
} from '@/lib/strategic-plan/api';
import { apiMessage } from '@/lib/strategic-plan/apiError';
import type { SpFundSource } from '@/lib/strategic-plan/types';

export function PlanFundSourceManager() {
  const [items, setItems] = useState<SpFundSource[]>([]);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchSpFundSources(true)
      .then(setItems)
      .catch(() => setItems([]));
  };

  useEffect(load, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createSpFundSource(name);
      setNewName('');
      load();
    } catch (e) {
      alert(apiMessage(e, '재원 추가 실패'));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (fund: SpFundSource, name: string) => {
    if (name.trim() === fund.fundSourceName) return;
    setBusy(true);
    try {
      await updateSpFundSource(fund.fundSourceId, { fundSourceName: name });
      load();
    } catch (e) {
      alert(apiMessage(e, '재원 이름 수정 실패'));
      load();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (fund: SpFundSource, isActive: boolean) => {
    setBusy(true);
    try {
      await updateSpFundSource(fund.fundSourceId, { isActive });
      load();
    } catch (e) {
      alert(apiMessage(e, '재원 상태 변경 실패'));
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
        updateSpFundSource(items[index].fundSourceId, { displayOrder: target }),
        updateSpFundSource(items[target].fundSourceId, { displayOrder: index }),
      ]);
      load();
    } catch (e) {
      alert(apiMessage(e, '순서 변경 실패'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (fund: SpFundSource) => {
    const ok = window.confirm(
      `재원 「${fund.fundSourceName}」을(를) 삭제할까요?\n이미 입력된 예산·결산이 있으면 삭제 대신 비활성으로 바뀝니다.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const result = await deleteSpFundSource(fund.fundSourceId);
      if (result.deactivated) {
        alert(
          `입력된 예산·결산이 ${result.used}건 있어 삭제하지 않고 비활성으로 바꿨습니다.`,
        );
      }
      load();
    } catch (e) {
      alert(apiMessage(e, '재원 삭제 실패'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>재원 유형</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          대시보드 예산·결산 탭에서 실행과제마다 나타나는 재원 목록입니다.
          비활성 재원은 새 입력에서 감춰지지만 이미 저장된 금액은 남습니다.
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="새 재원 이름"
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
            <Plus className="mr-1 h-4 w-4" /> 재원 추가
          </Button>
        </div>

        <div className="divide-y rounded-md border">
          {items.map((fund, index) => (
            <div
              key={fund.fundSourceId}
              className="flex flex-wrap items-center gap-2 px-3 py-2"
            >
              <Input
                defaultValue={fund.fundSourceName}
                disabled={busy}
                onBlur={(e) => void handleRename(fund, e.target.value)}
                className="h-8 max-w-xs"
                aria-label={`${fund.fundSourceName} 이름`}
              />
              {!fund.isActive && <Badge variant="secondary">비활성</Badge>}
              <div className="ml-auto flex items-center gap-1">
                <label className="mr-2 flex items-center gap-1.5 text-xs">
                  <Switch
                    checked={fund.isActive}
                    disabled={busy}
                    onCheckedChange={(v) => void handleToggleActive(fund, v)}
                    aria-label={`${fund.fundSourceName} 사용 여부`}
                  />
                  사용
                </label>
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
                  onClick={() => void handleDelete(fund)}
                  title="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              등록된 재원이 없습니다.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
