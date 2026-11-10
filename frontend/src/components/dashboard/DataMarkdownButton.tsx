'use client';

import { FileText } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  analysisMarkdownFilename,
  buildAnalysisMarkdown,
} from '@/lib/analysisMarkdown';
import { useAnalysisStore } from '@/store/AnalysisStoreProvider';
import { Button } from '@/components/ui/button';

const SCREEN_TITLE = {
  disclosure: '대학정보공시 데이터 검색 및 조회',
  internal: '학과별 자체 경쟁력 분석 지표',
} as const;

export function DataMarkdownButton() {
  const pathname = usePathname();
  const scope = useAnalysisStore((s) => s.analysisScope);
  const targets = useAnalysisStore((s) => s.selectedTargets);
  const metrics = useAnalysisStore((s) => s.selectedMetrics);
  const years = useAnalysisStore((s) => s.years);
  const pivot = useAnalysisStore((s) => s.pivot);
  const relativeScales = useAnalysisStore((s) => s.relativeScales);
  const relativeExpand = useAnalysisStore((s) => s.relativeExpand);
  const loading = useAnalysisStore((s) => s.loading);
  const relativeLoading = useAnalysisStore((s) => s.relativeLoading);

  const hasData = !!pivot && pivot.rows.length > 0;
  const busy = loading || relativeLoading;

  const handleDownload = () => {
    if (!pivot || pivot.rows.length === 0) return;
    const markdown = buildAnalysisMarkdown({
      screenTitle: SCREEN_TITLE[scope],
      pathname,
      scope,
      targets,
      metrics,
      years,
      pivot,
      relativeScales,
      relativeExpand,
    });
    const blob = new Blob([markdown], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = analysisMarkdownFilename(scope);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex justify-end">
      <Button
        variant="outline"
        onClick={handleDownload}
        disabled={!hasData || busy}
        title={
          hasData
            ? '조회된 원자료, 추이, 기술통계, 상대비교를 마크다운 파일로 받습니다'
            : '조회된 데이터가 없습니다'
        }
      >
        <FileText className="h-4 w-4" />
        데이터 마크다운
      </Button>
    </div>
  );
}
