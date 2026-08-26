import { SpCodeBadge } from '@/components/strategic-plan/SpCodeBadge';
import { Badge } from '@/components/ui/badge';
import type { SpTask } from '@/lib/strategic-plan/types';
import { cn } from '@/lib/utils';

/** 실행과제 제목 공통 헤더: 코드+과제명 / 책임부서·특성화 / (상세조회만) KPI·TASK */
export function TaskHeading({
  task,
  showKpiTaskCounts = false,
  titleClassName,
}: {
  task: SpTask;
  showKpiTaskCounts?: boolean;
  titleClassName?: string;
}) {
  const hasLeftMeta = Boolean(task.primaryDept) || task.isSpecialized;
  const showMeta = hasLeftMeta || showKpiTaskCounts;

  return (
    <span className="block min-w-0 w-full flex-1">
      <span
        className={cn(
          'flex flex-wrap items-center gap-1.5 font-bold',
          titleClassName,
        )}
      >
        <SpCodeBadge level="task">{task.displayCode ?? task.taskCode}</SpCodeBadge>
        <span>{task.taskName}</span>
      </span>
      {showMeta && (
        <span className="mt-1 flex w-full items-center justify-between gap-3">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {task.primaryDept && (
              <Badge variant="outline">{task.primaryDept}</Badge>
            )}
            {task.isSpecialized && (
              <Badge
                className="border-[#bb1b6f] bg-[#bb1b6f] text-white"
              >
                특성화 연계
              </Badge>
            )}
          </span>
          {showKpiTaskCounts && (
            <span className="ml-auto shrink-0 text-muted-foreground">
              KPI {task.kpiCodes.length} · TASK {task.subtasks.length}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
