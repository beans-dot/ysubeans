'use client';

import { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { IR_WORK_SAVE_EVENT, notifyAutoSaved } from '@/components/admin/AutoSaveToast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/strategic-plan/ui';
import {
  createSpGoal,
  createSpStrategy,
  createSpSubtask,
  createSpTask,
  deleteSpGoal,
  deleteSpStrategy,
  deleteSpSubtask,
  deleteSpTask,
  fetchSpDepartments,
  updateSpGoal,
  updateSpStrategy,
  updateSpSubtask,
  updateSpTask,
} from '@/lib/strategic-plan/api';
import { apiMessage } from '@/lib/strategic-plan/apiError';
import { goalAccent } from '@/lib/strategic-plan/goalAccent';
import type {
  SpDepartment,
  SpGoal,
  SpStrategy,
  SpSubtask,
  SpTask,
  SpTree,
} from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';

function codeOf(item: { displayCode?: string; taskCode?: string; strategyId?: string; goalId?: string; subtaskCode?: string }) {
  return (
    item.displayCode ||
    item.taskCode ||
    item.strategyId ||
    item.goalId ||
    item.subtaskCode ||
    ''
  );
}

function ItemMenu({
  disabled,
  onEdit,
  onAbolish,
}: {
  disabled: boolean;
  onEdit: () => void;
  onAbolish: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">편집</span>
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[7rem] rounded-md border bg-background py-1 shadow-md"
        >
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            수정
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-accent"
            onClick={() => {
              setOpen(false);
              onAbolish();
            }}
          >
            폐지
          </button>
        </div>
      )}
    </div>
  );
}

type DialogState =
  | { mode: 'create'; kind: 'goal' }
  | { mode: 'create'; kind: 'strategy'; goalId: string }
  | { mode: 'create'; kind: 'task'; strategyId: string }
  | { mode: 'create'; kind: 'subtask'; task: SpTask }
  | {
      mode: 'edit';
      kind: 'goal';
      id: string;
      name: string;
    }
  | {
      mode: 'edit';
      kind: 'strategy';
      id: string;
      name: string;
    }
  | {
      mode: 'edit';
      kind: 'task';
      id: string;
      name: string;
      hangul: string;
      specialized: boolean;
      dept: string;
    }
  | {
      mode: 'edit';
      kind: 'subtask';
      id: string;
      name: string;
      hangul: string;
      purpose: string;
      method: string;
      parentHangul: string;
    }
  | {
      mode: 'abolish';
      kind: 'goal' | 'strategy' | 'task' | 'subtask';
      id: string;
      label: string;
      childWarning: boolean;
    };

export function PlanStructureManager({
  tree,
  reload,
}: {
  tree: SpTree;
  reload: () => Promise<void>;
}) {
  const years = tree.years;
  const defaultYear = years[years.length - 1] ?? new Date().getFullYear();
  const [departments, setDepartments] = useState<SpDepartment[]>([]);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [year, setYear] = useState(defaultYear);
  const [name, setName] = useState('');
  const [alpha, setAlpha] = useState('');
  const [hangul, setHangul] = useState('');
  const [purpose, setPurpose] = useState('');
  const [method, setMethod] = useState('');
  const [seqNo, setSeqNo] = useState('');
  const [specialized, setSpecialized] = useState(false);
  const [dept, setDept] = useState('');

  useEffect(() => {
    fetchSpDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    const onSave = () => {
      void reload().then(() => notifyAutoSaved());
    };
    window.addEventListener(IR_WORK_SAVE_EVENT, onSave);
    return () => window.removeEventListener(IR_WORK_SAVE_EVENT, onSave);
  }, [reload]);

  const openCreate = (state: Extract<DialogState, { mode: 'create' }>) => {
    setDialog(state);
    setYear(defaultYear);
    setName('');
    setAlpha('');
    setHangul(state.kind === 'subtask' ? state.task.hangulCode ?? '' : '');
    setPurpose('');
    setMethod('');
    setSeqNo('');
    setSpecialized(false);
    setDept('');
  };

  const openEdit = (state: Extract<DialogState, { mode: 'edit' }>) => {
    setDialog(state);
    setYear(defaultYear);
    setName(state.name);
    if (state.kind === 'task' || state.kind === 'subtask') {
      setHangul(state.hangul);
    }
    if (state.kind === 'task') {
      setSpecialized(state.specialized);
      setDept(state.dept);
    }
    if (state.kind === 'subtask') {
      setPurpose(state.purpose);
      setMethod(state.method);
    }
  };

  const openAbolish = (state: Extract<DialogState, { mode: 'abolish' }>) => {
    setDialog(state);
    setYear(defaultYear);
  };

  const close = () => setDialog(null);

  const submit = async () => {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog.mode === 'create') {
        if (dialog.kind === 'goal') {
          await createSpGoal({
            goalId: alpha.trim().toUpperCase(),
            goalName: name.trim(),
            year,
          });
        } else if (dialog.kind === 'strategy') {
          await createSpStrategy({
            strategyId: alpha.trim().toUpperCase(),
            goalId: dialog.goalId,
            strategyName: name.trim(),
            year,
          });
        } else if (dialog.kind === 'task') {
          await createSpTask({
            taskCode: alpha.trim().toUpperCase(),
            hangulCode: hangul.trim(),
            taskName: name.trim(),
            strategyId: dialog.strategyId,
            isSpecialized: specialized,
            primaryDept: dept.trim() || undefined,
            year,
          });
        } else {
          await createSpSubtask({
            taskCode: dialog.task.taskCode,
            hangulCode: hangul.trim() || dialog.task.hangulCode,
            seqNo: seqNo.trim() ? Number(seqNo) : undefined,
            subtaskName: name.trim(),
            purpose: purpose.trim() || undefined,
            method: method.trim() || undefined,
            year,
          });
        }
      } else if (dialog.mode === 'edit') {
        if (dialog.kind === 'goal') {
          await updateSpGoal(dialog.id, { goalName: name.trim(), year });
        } else if (dialog.kind === 'strategy') {
          await updateSpStrategy(dialog.id, {
            strategyName: name.trim(),
            year,
          });
        } else if (dialog.kind === 'task') {
          await updateSpTask(dialog.id, {
            taskName: name.trim(),
            hangulCode: hangul.trim(),
            isSpecialized: specialized,
            primaryDept: dept.trim(),
            year,
          });
        } else {
          const nextHangul = hangul.trim();
          if (nextHangul && nextHangul !== dialog.parentHangul) {
            const ok = window.confirm(
              `한글코드가 실행과제명(${dialog.parentHangul || '없음'})과 다릅니다. 계속할까요?`,
            );
            if (!ok) {
              setBusy(false);
              return;
            }
          }
          await updateSpSubtask(dialog.id, {
            subtaskName: name.trim(),
            hangulCode: nextHangul,
            purpose: purpose.trim() || null,
            method: method.trim() || null,
            year,
          });
        }
      } else {
        if (dialog.kind === 'goal') await deleteSpGoal(dialog.id, year);
        else if (dialog.kind === 'strategy') await deleteSpStrategy(dialog.id, year);
        else if (dialog.kind === 'task') await deleteSpTask(dialog.id, year);
        else await deleteSpSubtask(dialog.id, year);
      }
      await reload();
      notifyAutoSaved();
      close();
    } catch (e) {
      alert(apiMessage(e, '저장에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const yearField = (
    <div className="grid gap-1.5">
      <Label htmlFor="sp-year">적용 학년도</Label>
      <NativeSelect
        id="sp-year"
        value={String(year)}
        onChange={(e) => setYear(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}학년도부터
          </option>
        ))}
      </NativeSelect>
      <p className="text-xs text-muted-foreground">
        선택한 학년도 이전 데이터는 그대로 두고, 해당 학년도부터 조회 화면에 반영됩니다.
      </p>
    </div>
  );

  const dialogTitle = useMemo(() => {
    if (!dialog) return '';
    const labels = {
      goal: '발전전략',
      strategy: '전략과제',
      task: '실행과제',
      subtask: 'TASK',
    };
    if (dialog.mode === 'create') return `${labels[dialog.kind]} 신설`;
    if (dialog.mode === 'edit') return `${labels[dialog.kind]} 수정`;
    return `${labels[dialog.kind]} 폐지`;
  }, [dialog]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          관리 화면은 항상 최신 체계를 보여 줍니다. 신설·수정·폐지는 적용 학년도를
          지정합니다.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => openCreate({ mode: 'create', kind: 'goal' })}
        >
          <Plus className="mr-1 h-4 w-4" /> 발전전략 신설
        </Button>
      </div>

      <div className="space-y-4">
        {tree.goals.map((goal) => (
          <GoalBlock
            key={goal.goalId}
            goal={goal}
            busy={busy}
            onCreateStrategy={() =>
              openCreate({ mode: 'create', kind: 'strategy', goalId: goal.goalId })
            }
            onCreateTask={(strategyId) =>
              openCreate({ mode: 'create', kind: 'task', strategyId })
            }
            onCreateSubtask={(task) =>
              openCreate({ mode: 'create', kind: 'subtask', task })
            }
            onEditGoal={() =>
              openEdit({
                mode: 'edit',
                kind: 'goal',
                id: goal.goalId,
                name: goal.goalName,
              })
            }
            onEditStrategy={(s) =>
              openEdit({
                mode: 'edit',
                kind: 'strategy',
                id: s.strategyId,
                name: s.strategyName,
              })
            }
            onEditTask={(t) =>
              openEdit({
                mode: 'edit',
                kind: 'task',
                id: t.taskCode,
                name: t.taskName,
                hangul: t.hangulCode ?? '',
                specialized: t.isSpecialized,
                dept: t.primaryDept ?? '',
              })
            }
            onEditSubtask={(t, s) =>
              openEdit({
                mode: 'edit',
                kind: 'subtask',
                id: s.subtaskCode,
                name: s.subtaskName,
                hangul: s.hangulCode ?? t.hangulCode ?? '',
                purpose: s.purpose ?? '',
                method: s.method ?? '',
                parentHangul: t.hangulCode ?? '',
              })
            }
            onAbolishGoal={() =>
              openAbolish({
                mode: 'abolish',
                kind: 'goal',
                id: goal.goalId,
                label: `${codeOf(goal)} ${goal.goalName}`,
                childWarning: goal.strategies.length > 0,
              })
            }
            onAbolishStrategy={(s) =>
              openAbolish({
                mode: 'abolish',
                kind: 'strategy',
                id: s.strategyId,
                label: `${codeOf(s)} ${s.strategyName}`,
                childWarning: s.tasks.length > 0,
              })
            }
            onAbolishTask={(t) =>
              openAbolish({
                mode: 'abolish',
                kind: 'task',
                id: t.taskCode,
                label: `${codeOf(t)} ${t.taskName}`,
                childWarning: t.subtasks.length > 0 || t.kpiCodes.length > 0,
              })
            }
            onAbolishSubtask={(s) =>
              openAbolish({
                mode: 'abolish',
                kind: 'subtask',
                id: s.subtaskCode,
                label: `${codeOf(s)} ${s.subtaskName}`,
                childWarning: false,
              })
            }
          />
        ))}
        {tree.goals.length === 0 && (
          <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            발전전략이 없습니다. 상단에서 신설해 주세요.
          </p>
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'abolish'
                ? '폐지 학년도를 정하면 그 이전 학년도 조회는 기존 체계를 유지합니다.'
                : '알파벳+숫자 코드는 이후 바꿀 수 없고, 한글 코드만 수정됩니다.'}
            </DialogDescription>
          </DialogHeader>

          {dialog?.mode === 'abolish' ? (
            <div className="space-y-3">
              {dialog.childWarning && (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  상위 위계를 폐지하면 하위 전략과제·실행과제·TASK·KPI가 함께
                  조회에서 사라집니다.
                </p>
              )}
              <p className="text-sm">{dialog.label}</p>
              {yearField}
            </div>
          ) : (
            <div className="space-y-3">
              {dialog?.mode === 'create' && dialog.kind !== 'subtask' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="sp-alpha">
                    {dialog.kind === 'goal'
                      ? '코드 (A, B …)'
                      : dialog.kind === 'strategy'
                        ? '코드 (A1, A2 …)'
                        : '알파벳+숫자 코드 (A11)'}
                  </Label>
                  <Input
                    id="sp-alpha"
                    value={alpha}
                    onChange={(e) => setAlpha(e.target.value)}
                    className="h-9 font-mono"
                  />
                </div>
              )}
              {dialog?.kind === 'task' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="sp-hangul">한글코드 (혁신, 교무 …)</Label>
                  <Input
                    id="sp-hangul"
                    value={hangul}
                    onChange={(e) => setHangul(e.target.value)}
                    className="h-9"
                    disabled={dialog.mode === 'edit' ? false : false}
                  />
                </div>
              )}
              {dialog?.kind === 'subtask' && (
                <>
                  {dialog.mode === 'create' && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="sp-seq">순번 (비우면 다음 번호)</Label>
                      <Input
                        id="sp-seq"
                        value={seqNo}
                        onChange={(e) => setSeqNo(e.target.value)}
                        className="h-9 font-mono"
                        inputMode="numeric"
                      />
                    </div>
                  )}
                  <div className="grid gap-1.5">
                    <Label htmlFor="sp-hangul">한글코드</Label>
                    <Input
                      id="sp-hangul"
                      value={hangul}
                      onChange={(e) => setHangul(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </>
              )}
              {dialog && dialog.kind !== 'subtask' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="sp-name">명칭</Label>
                  <Input
                    id="sp-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9"
                  />
                </div>
              )}
              {dialog?.kind === 'subtask' && (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="sp-name">TASK명</Label>
                    <Input
                      id="sp-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="sp-purpose">추진내용</Label>
                    <Textarea
                      id="sp-purpose"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="sp-method">추진방법</Label>
                    <Textarea
                      id="sp-method"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    />
                  </div>
                </>
              )}
              {dialog?.kind === 'task' && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={specialized}
                      onCheckedChange={(v) => setSpecialized(v === true)}
                    />
                    특성화
                  </label>
                  <div className="grid gap-1.5">
                    <Label htmlFor="sp-dept">담당부서</Label>
                    <NativeSelect
                      id="sp-dept"
                      value={dept}
                      onChange={(e) => setDept(e.target.value)}
                    >
                      <option value="">선택</option>
                      {departments.map((d) => (
                        <option key={d.deptId} value={d.deptName}>
                          {d.deptName}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </>
              )}
              {yearField}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              취소
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {dialog?.mode === 'abolish' ? '폐지' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoalBlock({
  goal,
  busy,
  onCreateStrategy,
  onCreateTask,
  onCreateSubtask,
  onEditGoal,
  onEditStrategy,
  onEditTask,
  onEditSubtask,
  onAbolishGoal,
  onAbolishStrategy,
  onAbolishTask,
  onAbolishSubtask,
}: {
  goal: SpGoal;
  busy: boolean;
  onCreateStrategy: () => void;
  onCreateTask: (strategyId: string) => void;
  onCreateSubtask: (task: SpTask) => void;
  onEditGoal: () => void;
  onEditStrategy: (s: SpStrategy) => void;
  onEditTask: (t: SpTask) => void;
  onEditSubtask: (t: SpTask, s: SpSubtask) => void;
  onAbolishGoal: () => void;
  onAbolishStrategy: (s: SpStrategy) => void;
  onAbolishTask: (t: SpTask) => void;
  onAbolishSubtask: (s: SpSubtask) => void;
}) {
  const accent = goalAccent(goal.goalId);
  return (
    <section className={cn('rounded-md border p-4', accent.border)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="flex min-w-0 flex-wrap items-center gap-2 font-bold">
          <Badge variant="code">{codeOf(goal)}</Badge>
          <span>{goal.goalName}</span>
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={busy}
            onClick={onCreateStrategy}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> 전략과제 신설
          </Button>
          <ItemMenu disabled={busy} onEdit={onEditGoal} onAbolish={onAbolishGoal} />
        </div>
      </div>
      <div className="space-y-3">
        {goal.strategies.map((strategy) => (
          <div key={strategy.strategyId} className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h4 className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-bold">
                <Badge variant="code">{codeOf(strategy)}</Badge>
                <span>{strategy.strategyName}</span>
              </h4>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={busy}
                  onClick={() => onCreateTask(strategy.strategyId)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> 실행과제 신설
                </Button>
                <ItemMenu
                  disabled={busy}
                  onEdit={() => onEditStrategy(strategy)}
                  onAbolish={() => onAbolishStrategy(strategy)}
                />
              </div>
            </div>
            <ul className="space-y-2">
              {strategy.tasks.map((task) => (
                <li key={task.taskCode} className="rounded-md border bg-background p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                        <Badge variant="code">{codeOf(task)}</Badge>
                        <span>{task.taskName}</span>
                        {task.isSpecialized && (
                          <Badge variant="secondary">특성화</Badge>
                        )}
                      </div>
                      {task.primaryDept && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          담당 {task.primaryDept}
                        </p>
                      )}
                      {task.kpiCodes.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          연계 KPI {task.kpiCodes.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={busy}
                        onClick={() => onCreateSubtask(task)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> TASK 신설
                      </Button>
                      <ItemMenu
                        disabled={busy}
                        onEdit={() => onEditTask(task)}
                        onAbolish={() => onAbolishTask(task)}
                      />
                    </div>
                  </div>
                  <ul className="space-y-2 pl-2">
                    {task.subtasks.map((sub) => (
                      <li
                        key={sub.subtaskId}
                        className="rounded-md border border-dashed p-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <Badge variant="code">{codeOf(sub)}</Badge>
                              <span>{sub.subtaskName}</span>
                            </div>
                            {(sub.purpose || sub.method) && (
                              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                {sub.purpose && <p>추진내용: {sub.purpose}</p>}
                                {sub.method && <p>추진방법: {sub.method}</p>}
                              </div>
                            )}
                          </div>
                          <ItemMenu
                            disabled={busy}
                            onEdit={() => onEditSubtask(task, sub)}
                            onAbolish={() => onAbolishSubtask(sub)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
