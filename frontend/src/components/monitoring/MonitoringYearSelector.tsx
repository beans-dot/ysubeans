'use client';

import { cn } from '@/lib/utils';

export function MonitoringYearSelector({
  years,
  value,
  onChange,
  id,
}: {
  years: number[];
  value: number;
  onChange: (year: number) => void;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-bold text-muted-foreground">조회 년도</span>
      <div
        id={id}
        role="group"
        aria-label="조회 년도"
        className="flex flex-wrap gap-1"
      >
        {years.map((year) => {
          const selected = year === value;
          return (
            <button
              key={year}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(year)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-bold transition-colors',
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}
