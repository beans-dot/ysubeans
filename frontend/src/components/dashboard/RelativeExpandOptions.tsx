'use client';

import { GitBranch } from 'lucide-react';
import { useAnalysisStore } from '@/store/AnalysisStoreProvider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function RelativeExpandOptions({ idPrefix = 'rel-expand' }: { idPrefix?: string }) {
  const analysisScope = useAnalysisStore((s) => s.analysisScope);
  const relativeExpand = useAnalysisStore((s) => s.relativeExpand);
  const setRelativeExpand = useAnalysisStore((s) => s.setRelativeExpand);

  if (analysisScope !== 'internal') return null;

  const seriesId = `${idPrefix}-all-series`;
  const deptsId = `${idPrefix}-all-depts`;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm font-bold">
        <GitBranch className="h-4 w-4" /> 상대비교 옵션
      </div>
      <p className="text-xs text-muted-foreground">
        대학 평균은 항상 표시됩니다. 옵션을 켜면 대상 선택과 무관하게 해당
        위계 전체를 상대비교에 넣습니다.
      </p>
      <div className="flex items-center justify-between">
        <Label htmlFor={seriesId}>전체 계열 보기</Label>
        <Switch
          id={seriesId}
          checked={relativeExpand.allSeries}
          onCheckedChange={(v) => setRelativeExpand({ allSeries: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor={deptsId}>전체 학과 보기</Label>
        <Switch
          id={deptsId}
          checked={relativeExpand.allDepts}
          onCheckedChange={(v) => setRelativeExpand({ allDepts: v })}
        />
      </div>
    </div>
  );
}
