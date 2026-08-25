'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SpVision } from '@/lib/strategic-plan/types';
import { useStrategicPlanStore } from '@/store/useStrategicPlanStore';
import { VisionEditor } from './VisionEditor';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

function visionFallbackHtml(vision: SpVision | null): string {
  if (!vision) return '';
  const text = visionPlainText(vision);
  if (!text) return '';
  return text
    .split('\n\n')
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function displayHtml(vision: SpVision | null): string {
  const saved = vision?.contentHtml?.trim();
  if (saved) return saved;
  return visionFallbackHtml(vision);
}

export function VisionPanel({
  vision,
  canEdit,
}: {
  vision: SpVision | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const patchVision = useStrategicPlanStore((s) => s.patchVision);
  const html = displayHtml(vision);

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      {canEdit && !editing && (
        <div className="flex justify-end border-b px-3 py-2">
          <Button type="button" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            수정
          </Button>
        </div>
      )}

      {editing ? (
        <VisionEditor
          initialHtml={html}
          onCancel={() => setEditing(false)}
          onSaved={(next) => {
            patchVision({ contentHtml: next });
            setEditing(false);
          }}
        />
      ) : html ? (
        <div
          className="sp-vision-doc px-4 py-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="px-4 py-10 text-center text-muted-foreground">
          {canEdit
            ? '수정 버튼을 눌러 비전 체계를 작성해 주세요.'
            : '비전 체계 내용이 아직 없습니다.'}
        </p>
      )}
    </div>
  );
}
