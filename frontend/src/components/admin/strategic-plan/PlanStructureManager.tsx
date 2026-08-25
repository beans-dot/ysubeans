'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/strategic-plan/ui';
import {
  createSpGoal,
  createSpStrategy,
  createSpTask,
  deleteSpGoal,
  deleteSpStrategy,
  deleteSpTask,
  fetchSpDepartments,
  replaceSpSubtasks,
  updateSpGoal,
  updateSpStrategy,
  updateSpTask,
} from '@/lib/strategic-plan/api';
import { apiMessage } from '@/lib/strategic-plan/apiError';
import { goalAccent } from '@/lib/strategic-plan/goalAccent';
import type { SpDepartment, SpGoal, SpStrategy, SpTask, SpTree } from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';

interface SubtaskDraft {
  subtaskCode: string;
  subtaskName: string;
}

function TaskEditor({
  task,
  strategies,
  departments,
  busy,
  setBusy,
  reload,
}: {
  task: SpTask;
  strategies: SpStrategy[];
  departments: SpDepartment[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  reload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [taskName, setTaskName] = useState(task.taskName);
  const [strategyId, setStrategyId] = useState(task.strategyId);
  const [isSpecialized, setIsSpecialized] = useState(task.isSpecialized);
  const [primaryDept, setPrimaryDept] = useState(task.primaryDept ?? '');
  const [relatedDepts, setRelatedDepts] = useState<string[]>(task.relatedDepts);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>(
    task.subtasks.map((s) => ({
      subtaskCode: s.subtaskCode,
      subtaskName: s.subtaskName,
    })),
  );

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateSpTask(task.taskCode, {
        taskName: taskName.trim(),
        strategyId,
        isSpecialized,
        primaryDept: primaryDept.trim(),
        relatedDepts: relatedDepts.filter((d) => d !== primaryDept.trim()),
      });
      await replaceSpSubtasks(
        task.taskCode,
        subtasks
          .filter((s) => s.subtaskCode.trim() && s.subtaskName.trim())
          .map((s) => ({
            subtaskCode: s.subtaskCode.trim(),
            subtaskName: s.subtaskName.trim(),
          })),
      );
      await reload();
      setOpen(false);
    } catch (e) {
      alert(apiMessage(e, '실행과제 저장 실패'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm(
      `실행과제 「${task.taskName}」(${task.taskCode})을(를) 삭제할까요?\n세부과제·자체평가·예산 입력이 함께 사라집니다.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteSpTask(task.taskCode);
      await reload();
    } catch (e) {
      alert(apiMessage(e, '실행과제 삭제 실패'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="border-b last:border-b-0">
      <div className="flex items-center gap-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
          />
          <span className="min-w-0 flex-1 truncate text-sm">
            {task.taskName}
          </span>
          <Badge variant="outline" className="font-mono text-[11px]">
            {task.taskCode}
          </Badge>
          {task.isSpecialized && <Badge variant="secondary">특성화</Badge>}
          <span className="text-xs text-muted-foreground">
            KPI {task.kpiCodes.length}
          </span>
        </button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => void handleDelete()}
          title="실행과제 삭제"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div className="grid gap-3 pb-3 pl-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={`tn-${task.taskCode}`}>실행과제명</Label>
              <Input
                id={`tn-${task.taskCode}`}
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ts-${task.taskCode}`}>소속 전략과제</Label>
              <NativeSelect
                id={`ts-${task.taskCode}`}
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
              >
                {strategies.map((s) => (
                  <option key={s.strategyId} value={s.strategyId}>
                    {s.strategyId} · {s.strategyName}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`tp-${task.taskCode}`}>책임부서</Label>
              <NativeSelect
                id={`tp-${task.taskCode}`}
                value={primaryDept}
                onChange={(e) => {
                  const next = e.target.value;
                  setPrimaryDept(next);
                  setRelatedDepts((prev) => prev.filter((d) => d !== next));
                }}
              >
                <option value="">미지정</option>
                {departments.map((d) => (
                  <option key={d.deptId} value={d.deptName}>
                    {d.deptName}
                  </option>
                ))}
                {primaryDept &&
                  !departments.some((d) => d.deptName === primaryDept) && (
                    <option value={primaryDept}>
                      {primaryDept} (목록에 없음)
                    </option>
                  )}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>연관부서</Label>
              {departments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  부서관리에서 부서를 먼저 등록해 주세요.
                </p>
              ) : (
                <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {departments.map((d) => {
                    const isPrimary = d.deptName === primaryDept;
                    return (
                      <label
                        key={d.deptId}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={relatedDepts.includes(d.deptName)}
                          disabled={isPrimary}
                          onCheckedChange={(v) => {
                            setRelatedDepts((prev) =>
                              v === true
                                ? [...prev, d.deptName]
                                : prev.filter((name) => name !== d.deptName),
                            );
                          }}
                        />
                        <span
                          className={
                            isPrimary ? 'text-muted-foreground' : undefined
                          }
                        >
                          {d.deptName}
                          {isPrimary ? ' (책임부서)' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isSpecialized}
                onCheckedChange={(v) => setIsSpecialized(v === true)}
              />
              대학특성화 연계과제
            </label>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>세부 TASK</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() =>
                  setSubtasks((prev) => [
                    ...prev,
                    {
                      subtaskCode: `${task.taskCode}-${prev.length + 1}`,
                      subtaskName: '',
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> 추가
              </Button>
            </div>
            <div className="space-y-1.5">
              {subtasks.map((sub, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={sub.subtaskCode}
                    onChange={(e) =>
                      setSubtasks((prev) =>
                        prev.map((s, i) =>
                          i === index
                            ? { ...s, subtaskCode: e.target.value }
                            : s,
                        ),
                      )
                    }
                    className="h-8 w-44 font-mono text-xs"
                    aria-label={`세부 TASK ${index + 1} 코드`}
                  />
                  <Input
                    value={sub.subtaskName}
                    onChange={(e) =>
                      setSubtasks((prev) =>
                        prev.map((s, i) =>
                          i === index
                            ? { ...s, subtaskName: e.target.value }
                            : s,
                        ),
                      )
                    }
                    className="h-8"
                    aria-label={`세부 TASK ${index + 1} 이름`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive hover:text-destructive"
                    onClick={() =>
                      setSubtasks((prev) => prev.filter((_, i) => i !== index))
                    }
                    title="행 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {subtasks.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  세부 TASK가 없습니다.
                </p>
              )}
            </div>
          </div>

          <div>
            <Button size="sm" disabled={busy} onClick={() => void handleSave()}>
              <Save className="mr-1 h-4 w-4" /> 실행과제 저장
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function StrategyBlock({
  goal,
  strategy,
  allStrategies,
  goals,
  departments,
  busy,
  setBusy,
  reload,
}: {
  goal: SpGoal;
  strategy: SpStrategy;
  allStrategies: SpStrategy[];
  goals: SpGoal[];
  departments: SpDepartment[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState(strategy.strategyName);
  const [newTaskCode, setNewTaskCode] = useState('');
  const [newTaskName, setNewTaskName] = useState('');

  const handleRename = async () => {
    if (name.trim() === strategy.strategyName) return;
    setBusy(true);
    try {
      await updateSpStrategy(strategy.strategyId, {
        strategyName: name.trim(),
      });
      await reload();
    } catch (e) {
      alert(apiMessage(e, '전략과제 수정 실패'));
      setName(strategy.strategyName);
    } finally {
      setBusy(false);
    }
  };

  const handleMoveGoal = async (goalId: string) => {
    setBusy(true);
    try {
      await updateSpStrategy(strategy.strategyId, { goalId });
      await reload();
    } catch (e) {
      alert(apiMessage(e, '발전전략 이동 실패'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm(
      `전략과제 「${strategy.strategyName}」(${strategy.strategyId})을(를) 삭제할까요?`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteSpStrategy(strategy.strategyId);
      await reload();
    } catch (e) {
      alert(apiMessage(e, '전략과제 삭제 실패'));
    } finally {
      setBusy(false);
    }
  };

  const handleAddTask = async () => {
    const code = newTaskCode.trim();
    const taskName = newTaskName.trim();
    if (!code || !taskName) return;
    setBusy(true);
    try {
      await createSpTask({
        taskCode: code,
        taskName,
        strategyId: strategy.strategyId,
      });
      setNewTaskCode('');
      setNewTaskName('');
      await reload();
    } catch (e) {
      alert(apiMessage(e, '실행과제 추가 실패'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('rounded-md border-l-4 border bg-background p-3', goalAccent(goal.goalId).border)}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono text-[11px]">
          {strategy.strategyId}
        </Badge>
        <Input
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void handleRename()}
          className="h-8 max-w-md"
          aria-label={`${strategy.strategyId} 전략과제명`}
        />
        <NativeSelect
          value={strategy.goalId}
          disabled={busy}
          onChange={(e) => void handleMoveGoal(e.target.value)}
          aria-label={`${strategy.strategyId} 소속 발전전략`}
          className="h-8"
        >
          {goals.map((g) => (
            <option key={g.goalId} value={g.goalId}>
              {g.goalId}. {g.goalName}
            </option>
          ))}
        </NativeSelect>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-8 px-2 text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => void handleDelete()}
          title="전략과제 삭제"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <ul className="mb-2">
        {strategy.tasks.map((task) => (
          <TaskEditor
            key={task.taskCode}
            task={task}
            strategies={allStrategies}
            departments={departments}
            busy={busy}
            setBusy={setBusy}
            reload={reload}
          />
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="새 실행과제 코드 (예: A16-교무)"
          value={newTaskCode}
          onChange={(e) => setNewTaskCode(e.target.value)}
          className="h-8 w-56 font-mono text-xs"
        />
        <Input
          placeholder="새 실행과제명"
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          className="h-8 max-w-sm"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !newTaskCode.trim() || !newTaskName.trim()}
          onClick={() => void handleAddTask()}
        >
          <Plus className="mr-1 h-4 w-4" /> 실행과제 추가
        </Button>
      </div>
    </div>
  );
}

export function PlanStructureManager({
  tree,
  reload,
}: {
  tree: SpTree;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [departments, setDepartments] = useState<SpDepartment[]>([]);
  const [newGoalId, setNewGoalId] = useState('');
  const [newGoalName, setNewGoalName] = useState('');
  const [newStrategyBy, setNewStrategyBy] = useState<
    Record<string, { id: string; name: string }>
  >({});

  const allStrategies = tree.goals.flatMap((g) => g.strategies);

  useEffect(() => {
    fetchSpDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, [tree]);

  const handleAddGoal = async () => {
    const goalId = newGoalId.trim().toUpperCase();
    const goalName = newGoalName.trim();
    if (!goalId || !goalName) return;
    setBusy(true);
    try {
      await createSpGoal({
        goalId,
        goalNo: tree.goals.length + 1,
        goalName,
      });
      setNewGoalId('');
      setNewGoalName('');
      await reload();
    } catch (e) {
      alert(apiMessage(e, '발전전략 추가 실패'));
    } finally {
      setBusy(false);
    }
  };

  const handleRenameGoal = async (goal: SpGoal, goalName: string) => {
    if (goalName.trim() === goal.goalName) return;
    setBusy(true);
    try {
      await updateSpGoal(goal.goalId, { goalName: goalName.trim() });
      await reload();
    } catch (e) {
      alert(apiMessage(e, '발전전략 수정 실패'));
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGoal = async (goal: SpGoal) => {
    const ok = window.confirm(
      `발전전략 「${goal.goalId}. ${goal.goalName}」을(를) 삭제할까요?`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteSpGoal(goal.goalId);
      await reload();
    } catch (e) {
      alert(apiMessage(e, '발전전략 삭제 실패'));
    } finally {
      setBusy(false);
    }
  };

  const handleAddStrategy = async (goal: SpGoal) => {
    const draft = newStrategyBy[goal.goalId];
    const strategyId = draft?.id.trim() ?? '';
    const strategyName = draft?.name.trim() ?? '';
    if (!strategyId || !strategyName) return;
    setBusy(true);
    try {
      await createSpStrategy({
        strategyId,
        goalId: goal.goalId,
        strategyName,
        displayOrder: allStrategies.length,
      });
      setNewStrategyBy((prev) => ({
        ...prev,
        [goal.goalId]: { id: '', name: '' },
      }));
      await reload();
    } catch (e) {
      alert(apiMessage(e, '전략과제 추가 실패'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>발전전략 · 전략과제 · 실행과제</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          코드는 대시보드 필터·KPI 연결의 기준이라 만든 뒤에는 바꿀 수 없습니다.
          이름과 소속만 수정할 수 있고, 하위 항목이 남아 있으면 삭제되지
          않습니다.
        </p>

        <div className="flex flex-wrap gap-2 rounded-md border p-3">
          <Input
            placeholder="새 발전전략 코드 (예: F)"
            value={newGoalId}
            onChange={(e) => setNewGoalId(e.target.value)}
            className="h-9 w-48 font-mono text-xs"
          />
          <Input
            placeholder="새 발전전략명"
            value={newGoalName}
            onChange={(e) => setNewGoalName(e.target.value)}
            className="h-9 max-w-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !newGoalId.trim() || !newGoalName.trim()}
            onClick={() => void handleAddGoal()}
          >
            <Plus className="mr-1 h-4 w-4" /> 발전전략 추가
          </Button>
        </div>

        {tree.goals.map((goal) => {
          const accent = goalAccent(goal.goalId);
          const draft = newStrategyBy[goal.goalId] ?? { id: '', name: '' };
          return (
            <section key={goal.goalId} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-white',
                    accent.dot,
                  )}
                >
                  {goal.goalId}
                </span>
                <Input
                  defaultValue={goal.goalName}
                  disabled={busy}
                  onBlur={(e) => void handleRenameGoal(goal, e.target.value)}
                  className="h-9 max-w-md"
                  aria-label={`${goal.goalId} 발전전략명`}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-2 text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => void handleDeleteGoal(goal)}
                  title="발전전략 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 pl-2">
                {goal.strategies.map((strategy) => (
                  <StrategyBlock
                    key={strategy.strategyId}
                    goal={goal}
                    strategy={strategy}
                    allStrategies={allStrategies}
                    goals={tree.goals}
                    departments={departments}
                    busy={busy}
                    setBusy={setBusy}
                    reload={reload}
                  />
                ))}

                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder={`새 전략과제 코드 (예: ${goal.goalId}9)`}
                    value={draft.id}
                    onChange={(e) =>
                      setNewStrategyBy((prev) => ({
                        ...prev,
                        [goal.goalId]: { ...draft, id: e.target.value },
                      }))
                    }
                    className="h-8 w-48 font-mono text-xs"
                  />
                  <Input
                    placeholder="새 전략과제명"
                    value={draft.name}
                    onChange={(e) =>
                      setNewStrategyBy((prev) => ({
                        ...prev,
                        [goal.goalId]: { ...draft, name: e.target.value },
                      }))
                    }
                    className="h-8 max-w-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !draft.id.trim() || !draft.name.trim()}
                    onClick={() => void handleAddStrategy(goal)}
                  >
                    <Plus className="mr-1 h-4 w-4" /> 전략과제 추가
                  </Button>
                </div>
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
