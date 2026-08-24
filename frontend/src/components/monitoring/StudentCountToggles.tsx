'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { StudentCountToggles } from '@/lib/monitoring/types';

const TOGGLE_ITEMS: Array<{
  key: keyof StudentCountToggles;
  label: string;
}> = [
  { key: 'includeInner', label: '정원 내' },
  { key: 'includeOuter', label: '정원 외' },
  { key: 'includeLeave', label: '휴학생' },
  { key: 'includeDeferred', label: '학위유예' },
];

export function StudentCountToggles({
  value,
  onChange,
}: {
  value: StudentCountToggles;
  onChange: (next: StudentCountToggles) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {TOGGLE_ITEMS.map((item) => (
        <label
          key={item.key}
          className="flex items-center justify-between gap-2 rounded-md border bg-background/80 px-2 py-1.5"
        >
          <Label htmlFor={`sc-${item.key}`} className="text-xs font-bold">
            {item.label}
          </Label>
          <Switch
            id={`sc-${item.key}`}
            checked={value[item.key]}
            onCheckedChange={(checked) =>
              onChange({ ...value, [item.key]: checked })
            }
          />
        </label>
      ))}
    </div>
  );
}
