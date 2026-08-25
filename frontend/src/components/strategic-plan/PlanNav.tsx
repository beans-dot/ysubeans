'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  useStrategicPlanStore,
  type SpView,
} from '@/store/useStrategicPlanStore';

interface NavLeaf {
  id: SpView;
  label: string;
}

interface NavGroup {
  id: string;
  label: string;
  children: NavLeaf[];
}

const NAV: Array<NavLeaf | NavGroup> = [
  { id: 'vision', label: '비전 체계' },
  {
    id: 'manage',
    label: '중장기발전계획 관리',
    children: [
      { id: 'strategy', label: '발전계획 상세 조회' },
      { id: 'budget', label: '발전계획 예결산' },
      { id: 'eval', label: '발전계획 기반 자체평가' },
    ],
  },
  {
    id: 'perf',
    label: '성과관리',
    children: [
      { id: 'kpi', label: '성과지표 조회' },
      { id: 'settlement', label: '결산 조회' },
      { id: 'eval-report', label: '자체평가 결과 조회' },
    ],
  },
];

function isGroup(item: NavLeaf | NavGroup): item is NavGroup {
  return 'children' in item;
}

function groupContains(group: NavGroup, view: SpView) {
  return group.children.some((c) => c.id === view);
}

function NavButton({
  label,
  active,
  nested,
  prominent,
  onClick,
}: {
  label: string;
  active: boolean;
  nested?: boolean;
  prominent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
        nested && 'pl-6',
        prominent && 'font-bold',
        active
          ? 'bg-primary text-primary-foreground font-bold'
          : 'hover:bg-accent',
      )}
    >
      {label}
    </button>
  );
}

export function PlanNav() {
  const view = useStrategicPlanStore((s) => s.view);
  const setView = useStrategicPlanStore((s) => s.setView);
  const [open, setOpen] = useState<Record<string, boolean>>({
    manage: true,
    perf: true,
  });

  return (
    <nav
      aria-label="중장기발전계획 메뉴"
      className="w-full shrink-0 lg:sticky lg:top-20 lg:w-56"
    >
      <ul className="space-y-1 rounded-md border p-2">
        {NAV.map((item) => {
          if (!isGroup(item)) {
            return (
              <li key={item.id}>
                <NavButton
                  label={item.label}
                  active={view === item.id}
                  prominent
                  onClick={() => setView(item.id)}
                />
              </li>
            );
          }

          const expanded = open[item.id] ?? groupContains(item, view);
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() =>
                  setOpen((prev) => ({ ...prev, [item.id]: !expanded }))
                }
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-accent"
              >
                {item.label}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    expanded && 'rotate-180',
                  )}
                />
              </button>
              {expanded && (
                <ul className="mt-0.5 space-y-0.5">
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <NavButton
                        nested
                        label={child.label}
                        active={view === child.id}
                        onClick={() => setView(child.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const VIEW_TITLES: Record<SpView, string> = {
  vision: '비전 체계',
  strategy: '발전계획 상세 조회',
  budget: '발전계획 예결산',
  eval: '발전계획 기반 자체평가',
  kpi: '성과지표 조회',
  settlement: '결산 조회',
  'eval-report': '자체평가 결과 조회',
};
