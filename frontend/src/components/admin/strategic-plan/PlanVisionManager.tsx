'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { replaceSpCompare, updateSpVision } from '@/lib/strategic-plan/api';
import { apiMessage } from '@/lib/strategic-plan/apiError';
import type { SpCompare, SpTree } from '@/lib/strategic-plan/types';

function toLines(items: string[]) {
  return items.join('\n');
}

function fromLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function VisionForm({
  tree,
  reload,
}: {
  tree: SpTree;
  reload: () => Promise<void>;
}) {
  const vision = tree.vision;
  const [officialName, setOfficialName] = useState(vision?.officialName ?? '');
  const [planPeriod, setPlanPeriod] = useState(vision?.planPeriod ?? '');
  const [visionStatement, setVisionStatement] = useState(
    vision?.visionStatement ?? '',
  );
  const [visionGoal, setVisionGoal] = useState(vision?.visionGoal ?? '');
  const [mission, setMission] = useState(vision?.mission ?? '');
  const [keyIndicators, setKeyIndicators] = useState(
    toLines(vision?.keyIndicators ?? []),
  );
  const [foundingPhilosophy, setFoundingPhilosophy] = useState(
    toLines(vision?.foundingPhilosophy ?? []),
  );
  const [mottoPairs, setMottoPairs] = useState(
    toLines(
      (vision?.mottoPairs ?? []).map((p) => `${p.motto} / ${p.talent}`),
    ),
  );
  const [talent3cName, setTalent3cName] = useState(
    vision?.talent3c?.name ?? '3C형 인재',
  );
  const [talent3cItems, setTalent3cItems] = useState(
    toLines(vision?.talent3c?.items ?? []),
  );
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateSpVision({
        officialName,
        planPeriod,
        visionStatement,
        visionGoal,
        mission,
        keyIndicators: fromLines(keyIndicators),
        foundingPhilosophy: fromLines(foundingPhilosophy),
        mottoPairs: fromLines(mottoPairs).map((line) => {
          const [motto, ...rest] = line.split('/');
          return {
            motto: (motto ?? '').trim(),
            talent: rest.join('/').trim(),
          };
        }),
        talent3c: {
          name: talent3cName.trim() || '3C형 인재',
          items: fromLines(talent3cItems),
        },
      });
      await reload();
      alert('비전 체계를 저장했습니다.');
    } catch (e) {
      alert(apiMessage(e, '비전 저장 실패'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>비전 체계</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="sp-official">계획 공식 명칭</Label>
          <Input
            id="sp-official"
            value={officialName}
            onChange={(e) => setOfficialName(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sp-period">계획 기간</Label>
          <Input
            id="sp-period"
            value={planPeriod}
            onChange={(e) => setPlanPeriod(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sp-goal">비전목표</Label>
          <Input
            id="sp-goal"
            value={visionGoal}
            onChange={(e) => setVisionGoal(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="sp-vision">비전</Label>
          <Input
            id="sp-vision"
            value={visionStatement}
            onChange={(e) => setVisionStatement(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="sp-mission">사명</Label>
          <Textarea
            id="sp-mission"
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            className="min-h-[60px]"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sp-founding">건학이념 (한 줄에 하나)</Label>
          <Textarea
            id="sp-founding"
            value={foundingPhilosophy}
            onChange={(e) => setFoundingPhilosophy(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sp-indicators">8대 주요지표 (한 줄에 하나)</Label>
          <Textarea
            id="sp-indicators"
            value={keyIndicators}
            onChange={(e) => setKeyIndicators(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="sp-motto">교훈·인재상 (한 줄에 「교훈 / 인재상」)</Label>
          <Textarea
            id="sp-motto"
            value={mottoPairs}
            onChange={(e) => setMottoPairs(e.target.value)}
            className="min-h-[90px]"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sp-3c-name">인재상 명칭</Label>
          <Input
            id="sp-3c-name"
            value={talent3cName}
            onChange={(e) => setTalent3cName(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sp-3c-items">인재상 요소 (한 줄에 하나)</Label>
          <Textarea
            id="sp-3c-items"
            value={talent3cItems}
            onChange={(e) => setTalent3cItems(e.target.value)}
            className="min-h-[90px]"
          />
        </div>
        <div className="sm:col-span-2">
          <Button size="sm" disabled={busy} onClick={() => void handleSave()}>
            <Save className="mr-1 h-4 w-4" /> 비전 저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompareForm({
  compare,
  reload,
}: {
  compare: SpCompare | null;
  reload: () => Promise<void>;
}) {
  const [text, setText] = useState(() =>
    JSON.stringify(compare ?? { years: [], indicators: [] }, null, 2),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    let parsed: SpCompare;
    try {
      parsed = JSON.parse(text) as SpCompare;
    } catch {
      setError('JSON 형식이 올바르지 않습니다.');
      return;
    }
    if (!Array.isArray(parsed.years) || !Array.isArray(parsed.indicators)) {
      setError('years 배열과 indicators 배열이 모두 필요합니다.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const saved = await replaceSpCompare(parsed);
      setText(JSON.stringify(saved, null, 2));
      await reload();
      alert('주요지표 비교 데이터를 저장했습니다.');
    } catch (e) {
      setError(apiMessage(e, '비교 데이터 저장 실패'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>주요지표 비교 데이터</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          대학알리미 공시값을 그대로 담은 JSON입니다. 저장하면 기존 비교
          데이터를 통째로 교체합니다.
        </p>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          spellCheck={false}
          className="min-h-[320px] font-mono text-xs"
          aria-label="비교 데이터 JSON"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="sm" disabled={busy} onClick={() => void handleSave()}>
          <Save className="mr-1 h-4 w-4" /> 비교 데이터 저장
        </Button>
      </CardContent>
    </Card>
  );
}

export function PlanVisionManager({
  tree,
  compare,
  reload,
}: {
  tree: SpTree;
  compare: SpCompare | null;
  reload: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <VisionForm tree={tree} reload={reload} />
      <CompareForm compare={compare} reload={reload} />
    </div>
  );
}
