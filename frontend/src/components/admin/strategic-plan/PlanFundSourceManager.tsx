'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { notifyAutoSaved } from '@/components/admin/AutoSaveToast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/strategic-plan/ui';
import {
  createSpFundSource,
  deleteSpFundSource,
  fetchSpFundSources,
  fetchSpTree,
  updateSpFundSource,
} from '@/lib/strategic-plan/api';
import { apiMessage } from '@/lib/strategic-plan/apiError';
import type { SpFundSource } from '@/lib/strategic-plan/types';

export function PlanFundSourceManager({
  asOfYear = null,
  readOnly = false,
}: {
  asOfYear?: number | null;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<SpFundSource[]>([]);
  const [years, setYears] = useState<number[]>([2022, 2023, 2024, 2025, 2026, 2027]);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<
    | { type: 'create'; name: string }
    | { type: 'rename'; fund: SpFundSource; name: string }
    | { type: 'abolish'; fund: SpFundSource }
    | null
  >(null);
  const [year, setYear] = useState(2025);

  const load = () => {
    if (asOfYear != null) {
      fetchSpFundSources(false, asOfYear)
        .then(setItems)
        .catch(() => setItems([]));
      return;
    }
    fetchSpFundSources(true)
      .then(setItems)
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
    fetchSpTree()
      .then((tree) => {
        setYears(tree.years);
        setYear(tree.years[tree.years.length - 1] ?? 2025);
      })
      .catch(() => undefined);
    // asOfYear 변경 시 해당 학년도 재원을 다시 불러온다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfYear]);

  const submitPending = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.type === 'create') {
        await createSpFundSource(pending.name, year);
        setNewName('');
      } else if (pending.type === 'rename') {
        await updateSpFundSource(pending.fund.fundSourceId, {
          fundSourceName: pending.name,
          year,
        });
      } else {
        await deleteSpFundSource(pending.fund.fundSourceId, year);
      }
      setPending(null);
      load();
      notifyAutoSaved();
    } catch (e) {
      alert(apiMessage(e, '재원 변경 실패'));
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>재원 유형</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          이름을 바꾸거나 폐지할 때 적용 학년도를 지정합니다. 그 이전 학년도 조회는
          기존 명칭을 따릅니다.
        </p>

        {!readOnly && (
          <div className="flex gap-2">
            <Input
              placeholder="새 재원 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newName.trim()) {
                    setPending({ type: 'create', name: newName.trim() });
                    setYear(years[years.length - 1] ?? year);
                  }
                }
              }}
              className="h-9 max-w-xs"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !newName.trim()}
              onClick={() => {
                setPending({ type: 'create', name: newName.trim() });
                setYear(years[years.length - 1] ?? year);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> 재원 신설
            </Button>
          </div>
        )}

        <div className="divide-y rounded-md border">
          {items.map((fund, index) => (
            <div
              key={fund.fundSourceId}
              className="flex flex-wrap items-center gap-2 px-3 py-2"
            >
              <Input
                defaultValue={fund.fundSourceName}
                disabled={busy || readOnly}
                readOnly={readOnly}
                onBlur={(e) => {
                  if (readOnly) return;
                  const name = e.target.value.trim();
                  if (!name || name === fund.fundSourceName) return;
                  setPending({ type: 'rename', fund, name });
                  setYear(years[years.length - 1] ?? year);
                }}
                className="h-8 max-w-xs"
                aria-label={`${fund.fundSourceName} 이름`}
              />
              {!fund.isActive || fund.abolishedFrom != null ? (
                <Badge variant="secondary">
                  {fund.abolishedFrom
                    ? `${fund.abolishedFrom}학년도부터 폐지`
                    : '폐지'}
                </Badge>
              ) : null}
              {!readOnly && (
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
                    onClick={() => {
                      setPending({ type: 'abolish', fund });
                      setYear(years[years.length - 1] ?? year);
                    }}
                  >
                    폐지
                  </Button>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              등록된 재원이 없습니다.
            </p>
          )}
        </div>
      </CardContent>

      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.type === 'create'
                ? '재원 신설'
                : pending?.type === 'rename'
                  ? '재원 수정'
                  : '재원 폐지'}
            </DialogTitle>
            <DialogDescription>
              적용 학년도부터 조회 화면에 반영됩니다. 그 이전은 기존 값을 유지합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label className="text-left">적용 학년도</Label>
            <NativeSelect
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}학년도부터
                </option>
              ))}
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              취소
            </Button>
            <Button disabled={busy} onClick={() => void submitPending()}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
