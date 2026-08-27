'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatValueWithUnit } from '@/lib/dataFormatters';
import type { ComponentToggleItem } from '@/lib/monitoring/types';

export function SubmetricToggles({
  items,
  unit,
  onChange,
}: {
  items: ComponentToggleItem[];
  unit: string | null;
  onChange: (id: string, on: boolean) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <label
          key={item.id}
          className="flex items-center justify-between gap-2 rounded-md border bg-background/80 px-2 py-1.5"
        >
          <div className="min-w-0">
            <Label htmlFor={`sm-${item.id}`} className="text-xs font-bold">
              {item.sign < 0 ? `− ${item.label}` : item.label}
            </Label>
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {formatValueWithUnit(item.value, unit)}
            </div>
          </div>
          <Switch
            id={`sm-${item.id}`}
            checked={item.on}
            onCheckedChange={(checked) => onChange(item.id, checked)}
          />
        </label>
      ))}
    </div>
  );
}
