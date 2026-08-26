import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SpCodeLevel = 'goal' | 'strategy' | 'task' | 'subtask' | 'kpi' | 'fund';

const GREEN = { r: 159, g: 194, b: 13 };
const GREEN_HEX = '#9fc20d';
const TEXT = '#3f4a08';

function mixWhite(t: number) {
  const r = Math.round(GREEN.r + (255 - GREEN.r) * t);
  const g = Math.round(GREEN.g + (255 - GREEN.g) * t);
  const b = Math.round(GREEN.b + (255 - GREEN.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** 위계가 내려갈수록 녹색을 20%씩 희석. KPI는 흰 바탕 + 녹색 테두리. */
const FILL: Record<SpCodeLevel, string> = {
  goal: mixWhite(0),
  strategy: mixWhite(0.2),
  task: mixWhite(0.4),
  subtask: mixWhite(0.6),
  kpi: '#ffffff',
  fund: mixWhite(0.4),
};

export function SpCodeBadge({
  level,
  children,
  className,
}: {
  level: SpCodeLevel;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs',
        className,
      )}
      style={{
        backgroundColor: FILL[level],
        borderColor: GREEN_HEX,
        color: TEXT,
        fontFamily: "'S-Core Dream', sans-serif",
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

export function spCodeLevelFromKind(kind: string): SpCodeLevel {
  if (
    kind === 'goal' ||
    kind === 'strategy' ||
    kind === 'task' ||
    kind === 'subtask' ||
    kind === 'kpi'
  ) {
    return kind;
  }
  return 'fund';
}
