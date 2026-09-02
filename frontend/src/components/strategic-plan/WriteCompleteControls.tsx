'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function WriteCompleteControls({
  completed,
  disabled,
  onComplete,
  onEdit,
  className,
}: {
  completed: boolean;
  disabled?: boolean;
  onComplete: () => void;
  onEdit: () => void;
  className?: string;
}) {
  if (completed) {
    return (
      <div className={cn('flex justify-end', className)}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onEdit}
        >
          수정
        </Button>
      </div>
    );
  }
  return (
    <div className={cn('flex justify-end', className)}>
      <label className="flex cursor-pointer items-center gap-1.5 text-sm font-bold">
        <Checkbox
          checked={false}
          disabled={disabled}
          onCheckedChange={(value) => {
            if (value === true) onComplete();
          }}
          aria-label="작성완료"
        />
        작성완료
      </label>
    </div>
  );
}
