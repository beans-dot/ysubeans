'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { notifyAutoSaved } from '@/components/admin/AutoSaveToast';
import { SpCodeBadge } from '@/components/strategic-plan/SpCodeBadge';
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
  SpKpi,
  SpStrategy,
  SpSubtask,
  SpTask,
  SpTree,
} from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';

function codeOf(item: {
  displayCode?: string;
  taskCode?: string;
  strategyId?: string;
  goalId?: string;
  subtaskCode?: string;
}) {
  return (
    item.displayCode ||
    item.taskCode ||
    item.strategyId ||
    item.goalId ||
    item.subtaskCode ||
    ''
  );
}

function YearField({
  id,
  year,
  years,
  onChange,
}: {
  id: string;
  year: number;
  years: number[];
  onChange: (year: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-left">
        적용 학년도
      </Label>
      <NativeSelect
        id={id}
        value={String(year)}
        onChange={(e) => onChange(Number(e.target.value))}
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
}

function EditorActions({
  disabled,
  onSave,
  onAbolish,
}: {
  disabled: boolean;
  onSave: () => void;
  onAbolish: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
        disabled={disabled}
        onClick={onSave}
      >
        수정
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
        disabled={disabled}
        onClick={onAbolish}
      >
        폐지
      </Button>
    </div>
  );
}

async function confirmAbolish(year: number, childWarning: boolean) {
  return window.confirm(
    childWarning
      ? `${year}학년도부터 폐지하면 하위 항목도 조회에서 사라집니다. 계속할까요?`
      : `${year}학년도부터 폐지할까요?`,
  );
}

type DialogState =
  | { mode: 'create'; kind: 'goal' }
  | { mode: 'create'; kind: 'strategy'; goalId: string }
  | { mode: 'create'; kind: 'task'; strategyId: string }
  | { mode: 'create'; kind: 'subtask'; task: SpTask };

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
  const [openKey, setOpenKey] = useState<string | null>(null);
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

  const openCreate = (state: DialogState) => {
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

  const close = () => setDialog(null);

  const submit = async () => {
    if (!dialog) return;
    setBusy(true);
    try {
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
      await reload();
      notifyAutoSaved();
      close();
    } catch (e) {
      alert(apiMessage(e, '저장에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const dialogTitle = useMemo(() => {
    if (!dialog) return '';
    const labels = {
      goal: '발전전략',
      strategy: '전략과제',
      task: '실행과제',
      subtask: 'TASK',
    };
    return `${labels[dialog.kind]} 신설`;
  }, [dialog]);

  const kpiByCode = useMemo(
    () => new Map(tree.kpis.map((k) => [k.kpiCode, k])),
    [tree.kpis],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          관리 화면은 항상 최신 체계를 보여 줍니다. 코드 옆 &#39;&gt;&#39;를 눌러
          내용을 고친 뒤 수정을 누르면 저장됩니다.
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
            years={years}
            departments={departments}
            kpiByCode={kpiByCode}
            openKey={openKey}
            setOpenKey={setOpenKey}
            reload={reload}
            onCreateStrategy={() =>
              openCreate({ mode: 'create', kind: 'strategy', goalId: goal.goalId })
            }
            onCreateTask={(strategyId) =>
              openCreate({ mode: 'create', kind: 'task', strategyId })
            }
            onCreateSubtask={(task) =>
              openCreate({ mode: 'create', kind: 'subtask', task })
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
              알파벳+숫자 코드는 이후 바꿀 수 없고, 한글 코드만 수정됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {dialog && dialog.kind !== 'subtask' && (
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
                  className="h-9"
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
                />
              </div>
            )}
            {dialog?.kind === 'subtask' && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="sp-seq">순번 (비우면 다음 번호)</Label>
                  <Input
                    id="sp-seq"
                    value={seqNo}
                    onChange={(e) => setSeqNo(e.target.value)}
                    className="h-9"
                    inputMode="numeric"
                  />
                </div>
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
                        {d.categoryName
                          ? `${d.deptName} (${d.categoryName})`
                          : d.deptName}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </>
            )}
            <YearField id="sp-year" year={year} years={years} onChange={setYear} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              취소
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChevronCode({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex items-center gap-1.5 text-left"
    >
      <ChevronRight
        className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')}
      />
      {children}
    </button>
  );
}

function GoalEditor({
  goal,
  years,
  reload,
}: {
  goal: SpGoal;
  years: number[];
  reload: () => Promise<void>;
}) {
  const [applyYear, setApplyYear] = useState(years[years.length - 1]);
  const [name, setName] = useState(goal.goalName);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateSpGoal(goal.goalId, { goalName: name.trim(), year: applyYear });
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, '저장에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const abolish = async () => {
    if (!(await confirmAbolish(applyYear, goal.strategies.length > 0))) return;
    setBusy(true);
    try {
      await deleteSpGoal(goal.goalId, applyYear);
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, '폐지에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 grid gap-3 rounded-md bg-muted/30 px-3 py-3">
      <YearField
        id={`gy-${goal.goalId}`}
        year={applyYear}
        years={years}
        onChange={setApplyYear}
      />
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`gn-${goal.goalId}`}>
          명칭
        </Label>
        <Input
          id={`gn-${goal.goalId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9"
        />
      </div>
      <EditorActions
        disabled={busy}
        onSave={() => void save()}
        onAbolish={() => void abolish()}
      />
    </div>
  );
}

function StrategyEditor({
  strategy,
  years,
  reload,
}: {
  strategy: SpStrategy;
  years: number[];
  reload: () => Promise<void>;
}) {
  const [applyYear, setApplyYear] = useState(years[years.length - 1]);
  const [name, setName] = useState(strategy.strategyName);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateSpStrategy(strategy.strategyId, {
        strategyName: name.trim(),
        year: applyYear,
      });
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, '저장에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const abolish = async () => {
    if (!(await confirmAbolish(applyYear, strategy.tasks.length > 0))) return;
    setBusy(true);
    try {
      await deleteSpStrategy(strategy.strategyId, applyYear);
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, '폐지에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 grid gap-3 rounded-md bg-muted/30 px-3 py-3">
      <YearField
        id={`sy-${strategy.strategyId}`}
        year={applyYear}
        years={years}
        onChange={setApplyYear}
      />
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`sn-${strategy.strategyId}`}>
          명칭
        </Label>
        <Input
          id={`sn-${strategy.strategyId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9"
        />
      </div>
      <EditorActions
        disabled={busy}
        onSave={() => void save()}
        onAbolish={() => void abolish()}
      />
    </div>
  );
}

function TaskEditor({
  task,
  years,
  departments,
  reload,
}: {
  task: SpTask;
  years: number[];
  departments: SpDepartment[];
  reload: () => Promise<void>;
}) {
  const [applyYear, setApplyYear] = useState(years[years.length - 1]);
  const [name, setName] = useState(task.taskName);
  const [hangul, setHangul] = useState(task.hangulCode ?? '');
  const [specialized, setSpecialized] = useState(task.isSpecialized);
  const [dept, setDept] = useState(task.primaryDept ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateSpTask(task.taskCode, {
        taskName: name.trim(),
        hangulCode: hangul.trim(),
        isSpecialized: specialized,
        primaryDept: dept.trim(),
        year: applyYear,
      });
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, '저장에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const abolish = async () => {
    if (
      !(await confirmAbolish(
        applyYear,
        task.subtasks.length > 0 || task.kpiCodes.length > 0,
      ))
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteSpTask(task.taskCode, applyYear);
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, '폐지에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 grid gap-3 rounded-md bg-muted/30 px-3 py-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <YearField
          id={`ty-${task.taskCode}`}
          year={applyYear}
          years={years}
          onChange={setApplyYear}
        />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label className="text-left" htmlFor={`tn-${task.taskCode}`}>
          명칭
        </Label>
        <Input
          id={`tn-${task.taskCode}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`th-${task.taskCode}`}>
          한글코드
        </Label>
        <Input
          id={`th-${task.taskCode}`}
          value={hangul}
          onChange={(e) => setHangul(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`td-${task.taskCode}`}>
          담당부서
        </Label>
        <NativeSelect
          id={`td-${task.taskCode}`}
          value={dept}
          onChange={(e) => setDept(e.target.value)}
        >
          <option value="">선택</option>
          {departments.map((d) => (
            <option key={d.deptId} value={d.deptName}>
              {d.categoryName ? `${d.deptName} (${d.categoryName})` : d.deptName}
            </option>
          ))}
        </NativeSelect>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <Checkbox
          checked={specialized}
          onCheckedChange={(v) => setSpecialized(v === true)}
        />
        특성화
      </label>
      <div className="sm:col-span-2">
        <EditorActions
          disabled={busy}
          onSave={() => void save()}
          onAbolish={() => void abolish()}
        />
      </div>
    </div>
  );
}

function SubtaskEditor({
  task,
  sub,
  years,
  reload,
}: {
  task: SpTask;
  sub: SpSubtask;
  years: number[];
  reload: () => Promise<void>;
}) {
  const [applyYear, setApplyYear] = useState(years[years.length - 1]);
  const [name, setName] = useState(sub.subtaskName);
  const [hangul, setHangul] = useState(sub.hangulCode ?? task.hangulCode ?? '');
  const [purpose, setPurpose] = useState(sub.purpose ?? '');
  const [method, setMethod] = useState(sub.method ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const nextHangul = hangul.trim();
    if (nextHangul && nextHangul !== (task.hangulCode ?? '')) {
      const ok = window.confirm(
        `한글코드가 실행과제명(${task.hangulCode || '없음'})과 다릅니다. 계속할까요?`,
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      await updateSpSubtask(sub.subtaskCode, {
        subtaskName: name.trim(),
        hangulCode: nextHangul,
        purpose: purpose.trim() || null,
        method: method.trim() || null,
        year: applyYear,
      });
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, '저장에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const abolish = async () => {
    if (!(await confirmAbolish(applyYear, false))) return;
    setBusy(true);
    try {
      await deleteSpSubtask(sub.subtaskCode, applyYear);
      notifyAutoSaved();
      await reload();
    } catch (e) {
      alert(apiMessage(e, '폐지에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 grid gap-3 rounded-md bg-muted/30 px-3 py-3">
      <YearField
        id={`uy-${sub.subtaskCode}`}
        year={applyYear}
        years={years}
        onChange={setApplyYear}
      />
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`un-${sub.subtaskCode}`}>
          TASK명
        </Label>
        <Input
          id={`un-${sub.subtaskCode}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`uh-${sub.subtaskCode}`}>
          한글코드
        </Label>
        <Input
          id={`uh-${sub.subtaskCode}`}
          value={hangul}
          onChange={(e) => setHangul(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`up-${sub.subtaskCode}`}>
          추진내용
        </Label>
        <Textarea
          id={`up-${sub.subtaskCode}`}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-left" htmlFor={`um-${sub.subtaskCode}`}>
          추진방법
        </Label>
        <Textarea
          id={`um-${sub.subtaskCode}`}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        />
      </div>
      <EditorActions
        disabled={busy}
        onSave={() => void save()}
        onAbolish={() => void abolish()}
      />
    </div>
  );
}

function GoalBlock({
  goal,
  busy,
  years,
  departments,
  kpiByCode,
  openKey,
  setOpenKey,
  reload,
  onCreateStrategy,
  onCreateTask,
  onCreateSubtask,
}: {
  goal: SpGoal;
  busy: boolean;
  years: number[];
  departments: SpDepartment[];
  kpiByCode: Map<string, SpKpi>;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
  reload: () => Promise<void>;
  onCreateStrategy: () => void;
  onCreateTask: (strategyId: string) => void;
  onCreateSubtask: (task: SpTask) => void;
}) {
  const accent = goalAccent(goal.goalId);
  const goalOpen = openKey === `goal:${goal.goalId}`;
  return (
    <section className={cn('rounded-md border p-4', accent.border)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="flex min-w-0 flex-wrap items-center gap-2 font-bold">
          <ChevronCode
            open={goalOpen}
            onToggle={() => setOpenKey(goalOpen ? null : `goal:${goal.goalId}`)}
          >
            <SpCodeBadge level="goal">{codeOf(goal)}</SpCodeBadge>
          </ChevronCode>
          <span>{goal.goalName}</span>
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          disabled={busy}
          onClick={onCreateStrategy}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> 전략과제 신설
        </Button>
      </div>
      {goalOpen && <GoalEditor goal={goal} years={years} reload={reload} />}
      <div className="space-y-3">
        {goal.strategies.map((strategy) => {
          const strategyOpen = openKey === `strategy:${strategy.strategyId}`;
          return (
            <div key={strategy.strategyId} className="rounded-md border bg-muted/20 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h4 className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-bold">
                  <ChevronCode
                    open={strategyOpen}
                    onToggle={() =>
                      setOpenKey(strategyOpen ? null : `strategy:${strategy.strategyId}`)
                    }
                  >
                    <SpCodeBadge level="strategy">{codeOf(strategy)}</SpCodeBadge>
                  </ChevronCode>
                  <span>{strategy.strategyName}</span>
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  disabled={busy}
                  onClick={() => onCreateTask(strategy.strategyId)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> 실행과제 신설
                </Button>
              </div>
              {strategyOpen && (
                <StrategyEditor strategy={strategy} years={years} reload={reload} />
              )}
              <ul className="space-y-2">
                {strategy.tasks.map((task) => {
                  const taskOpen = openKey === `task:${task.taskCode}`;
                  const linked = task.kpiCodes
                    .map((code) => kpiByCode.get(code))
                    .filter((k): k is SpKpi => Boolean(k));
                  return (
                    <li key={task.taskCode} className="rounded-md border bg-background p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                            <ChevronCode
                              open={taskOpen}
                              onToggle={() =>
                                setOpenKey(taskOpen ? null : `task:${task.taskCode}`)
                              }
                            >
                              <SpCodeBadge level="task">{codeOf(task)}</SpCodeBadge>
                            </ChevronCode>
                            <span>{task.taskName}</span>
                            {task.isSpecialized && (
                              <Badge variant="secondary">특성화</Badge>
                            )}
                          </div>
                          <div className="mt-2 max-w-full overflow-x-auto">
                            <div className="inline-flex items-center gap-x-5 whitespace-nowrap rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
                              <span>
                                <span className="font-bold text-muted-foreground">
                                  담당부서
                                </span>{' '}
                                {task.primaryDept || '–'}
                              </span>
                              <span>
                                <span className="font-bold text-muted-foreground">
                                  연계 KPI
                                </span>{' '}
                                {linked.length === 0
                                  ? '–'
                                  : linked
                                      .map((kpi) => kpi.kpiName)
                                      .join(', ')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0"
                          disabled={busy}
                          onClick={() => onCreateSubtask(task)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> TASK 신설
                        </Button>
                      </div>
                      {taskOpen && (
                        <TaskEditor
                          task={task}
                          years={years}
                          departments={departments}
                          reload={reload}
                        />
                      )}
                      <ul className="space-y-2 pl-2">
                        {task.subtasks.map((sub) => {
                          const subOpen = openKey === `subtask:${sub.subtaskCode}`;
                          return (
                            <li
                              key={sub.subtaskId}
                              className="rounded-md border border-dashed p-2"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <ChevronCode
                                    open={subOpen}
                                    onToggle={() =>
                                      setOpenKey(
                                        subOpen ? null : `subtask:${sub.subtaskCode}`,
                                      )
                                    }
                                  >
                                    <SpCodeBadge level="subtask">
                                      {codeOf(sub)}
                                    </SpCodeBadge>
                                  </ChevronCode>
                                  <span>{sub.subtaskName}</span>
                                </div>
                                {!subOpen && (sub.purpose || sub.method) && (
                                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                    {sub.purpose && <p>추진내용: {sub.purpose}</p>}
                                    {sub.method && <p>추진방법: {sub.method}</p>}
                                  </div>
                                )}
                              </div>
                              {subOpen && (
                                <SubtaskEditor
                                  task={task}
                                  sub={sub}
                                  years={years}
                                  reload={reload}
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
