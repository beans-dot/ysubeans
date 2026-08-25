'use client';

import { useId } from 'react';
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
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <label htmlFor={selectId} className="flex items-center gap-2">
      <span className="text-sm font-bold text-muted-foreground">조회 년도</span>
      <select
        id={selectId}
        aria-label="조회 년도"
        value={String(value)}
        disabled={years.length === 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          'h-9 min-w-[6.5rem] rounded-md border border-input bg-background px-2 text-sm font-bold',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {years.map((year) => (
          <option key={year} value={String(year)}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}
