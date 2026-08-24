export interface GoalAccent {
  /** 점·막대 배경 */
  dot: string;
  /** 배지 (연한 배경 + 진한 글자) */
  badge: string;
  /** 카드 왼쪽 보더 */
  border: string;
  /** 강조 텍스트 */
  text: string;
  /** Recharts·SVG용 색상값 */
  hex: string;
}

const ACCENTS: Record<string, GoalAccent> = {
  A: {
    dot: 'bg-blue-600',
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    border: 'border-l-blue-600',
    text: 'text-blue-700',
    hex: '#2563EB',
  },
  B: {
    dot: 'bg-emerald-700',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    border: 'border-l-emerald-700',
    text: 'text-emerald-700',
    hex: '#047857',
  },
  C: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    border: 'border-l-rose-500',
    text: 'text-rose-700',
    hex: '#F43F5E',
  },
  D: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-900 border-amber-200',
    border: 'border-l-amber-500',
    text: 'text-amber-700',
    hex: '#F59E0B',
  },
  E: {
    dot: 'bg-teal-600',
    badge: 'bg-teal-50 text-teal-800 border-teal-200',
    border: 'border-l-teal-600',
    text: 'text-teal-700',
    hex: '#0D9488',
  },
};

const FALLBACK: GoalAccent = {
  dot: 'bg-slate-500',
  badge: 'bg-slate-50 text-slate-700 border-slate-200',
  border: 'border-l-slate-500',
  text: 'text-slate-700',
  hex: '#64748B',
};

export function goalAccent(goalId: string | null | undefined): GoalAccent {
  if (!goalId) return FALLBACK;
  return ACCENTS[goalId] ?? FALLBACK;
}
