import * as React from 'react';
import { cn } from '@/lib/utils';

/** 저장소에 shadcn Select가 없어 네이티브 select를 같은 톤으로 맞춘다. */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
NativeSelect.displayName = 'NativeSelect';

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function YearSelect({
  years,
  year,
  onChange,
  label = '학년도',
}: {
  years: number[];
  year: number;
  onChange: (year: number) => void;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <NativeSelect
        value={String(year)}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      >
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}학년도
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h4
      className={cn(
        'mb-1.5 font-bold tracking-wide text-muted-foreground',
        className,
      )}
    >
      {children}
    </h4>
  );
}

/** 자체평가 ①~⑤ 소제목 */
export function EvalSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h4 className={cn('sp-eval-section-title mb-1.5', className)}>{children}</h4>
  );
}
