'use client';

import { useMemo, useState } from 'react';
import { Copy, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SpVision } from '@/lib/strategic-plan/types';

function visionPlainText(vision: SpVision): string {
  const blocks: string[] = [];
  if (vision.officialName) {
    blocks.push(`공식 명칭\n${vision.officialName}`);
  }
  if (vision.planPeriod) {
    blocks.push(`계획 기간\n${vision.planPeriod}`);
  }
  if (vision.visionStatement) {
    blocks.push(`비전\n${vision.visionStatement}`);
  }
  if (vision.visionGoal) {
    blocks.push(`비전목표\n${vision.visionGoal}`);
  }
  if (vision.mission) {
    blocks.push(`사명\n${vision.mission}`);
  }
  if (vision.foundingPhilosophy.length > 0) {
    blocks.push(`건학이념\n${vision.foundingPhilosophy.join('\n')}`);
  }
  if (vision.mottoPairs.length > 0) {
    blocks.push(
      `교훈·인재상\n${vision.mottoPairs
        .map((p) => `${p.motto} — ${p.talent}`)
        .join('\n')}`,
    );
  }
  if (vision.talent3c) {
    blocks.push(
      `${vision.talent3c.name}\n${vision.talent3c.items.join('\n')}`,
    );
  }
  if (vision.keyIndicators.length > 0) {
    blocks.push(`8대 핵심지표\n${vision.keyIndicators.join('\n')}`);
  }
  if (vision.structureSummary) {
    blocks.push(`계획 체계\n${vision.structureSummary}`);
  }
  return blocks.join('\n\n');
}

export function VisionPanel({ vision }: { vision: SpVision }) {
  const text = useMemo(() => visionPlainText(vision), [vision]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          <Copy className="mr-1.5 h-4 w-4" />
          {copied ? '복사됨' : '텍스트 복사'}
        </Button>
      </div>
      <pre className="whitespace-pre-wrap break-words leading-7">
        {text || '비전 체계 내용이 아직 없습니다. 관리자 화면에서 입력해 주세요.'}
      </pre>
      <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
        <FileText className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          상세 해설 PDF는 추후 이 자리에서 내려받을 수 있게 할 예정입니다.
        </span>
      </div>
    </div>
  );
}
