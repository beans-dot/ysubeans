export type SpNodeKind =
  | 'goal'
  | 'strategy'
  | 'task'
  | 'subtask'
  | 'kpi'
  | 'fund';

export type SpChangeType = 'create' | 'update' | 'abolish' | 'rollback';

const TASK_RE = /^([A-Za-z]\d+)(?:-([^-]+))?$/;
const SUBTASK_RE = /^([A-Za-z]\d+)-([^-]+)-(\d+)$/;
const SUBTASK_ALPHA_RE = /^([A-Za-z]\d+)-(\d+)$/;
const KPI_RE = /^([A-Za-z]\d+)([a-z])$/;
const STRATEGY_RE = /^[A-Za-z]\d+$/;
const GOAL_RE = /^[A-Za-z]$/;

export function parseTaskCode(raw: string): {
  alphaCode: string;
  hangulCode: string;
} {
  const value = raw.trim();
  const m = TASK_RE.exec(value);
  if (!m) {
    return { alphaCode: value, hangulCode: '' };
  }
  return { alphaCode: m[1].toUpperCase(), hangulCode: m[2] ?? '' };
}

export function parseSubtaskCode(raw: string): {
  alphaCode: string;
  taskAlpha: string;
  hangulCode: string;
  seq: number;
} {
  const value = raw.trim();
  const full = SUBTASK_RE.exec(value);
  if (full) {
    const taskAlpha = full[1].toUpperCase();
    const seq = Number(full[3]);
    return {
      alphaCode: `${taskAlpha}-${seq}`,
      taskAlpha,
      hangulCode: full[2],
      seq,
    };
  }
  const alpha = SUBTASK_ALPHA_RE.exec(value);
  if (alpha) {
    const taskAlpha = alpha[1].toUpperCase();
    const seq = Number(alpha[2]);
    return {
      alphaCode: `${taskAlpha}-${seq}`,
      taskAlpha,
      hangulCode: '',
      seq,
    };
  }
  return { alphaCode: value, taskAlpha: '', hangulCode: '', seq: 0 };
}

export function parseKpiCode(raw: string): { alphaCode: string; taskAlpha: string } {
  const value = raw.trim();
  const m = KPI_RE.exec(value);
  if (!m) return { alphaCode: value, taskAlpha: '' };
  return { alphaCode: `${m[1].toUpperCase()}${m[2]}`, taskAlpha: m[1].toUpperCase() };
}

export function isGoalAlpha(code: string) {
  return GOAL_RE.test(code.trim());
}

export function isStrategyAlpha(code: string) {
  return STRATEGY_RE.test(code.trim());
}

export function displayGoal(alpha: string) {
  return alpha.trim().toUpperCase();
}

export function displayStrategy(alpha: string) {
  return alpha.trim().toUpperCase();
}

export function displayTask(alphaCode: string, hangulCode?: string | null) {
  const hangul = (hangulCode ?? '').trim();
  return hangul ? `${alphaCode}-${hangul}` : alphaCode;
}

export function displaySubtask(
  taskAlpha: string,
  seq: number,
  hangulCode?: string | null,
) {
  const hangul = (hangulCode ?? '').trim();
  return hangul ? `${taskAlpha}-${hangul}-${seq}` : `${taskAlpha}-${seq}`;
}

export function displayKpi(alphaCode: string) {
  return alphaCode;
}

export function kindLabel(kind: SpNodeKind) {
  if (kind === 'goal') return '발전전략';
  if (kind === 'strategy') return '전략과제';
  if (kind === 'task') return '실행과제';
  if (kind === 'subtask') return 'TASK';
  if (kind === 'kpi') return 'KPI';
  return '재원 유형';
}

export function changeTypeLabel(type: SpChangeType) {
  if (type === 'create') return '신설';
  if (type === 'update') return '수정';
  if (type === 'abolish') return '폐지';
  return '롤백';
}
