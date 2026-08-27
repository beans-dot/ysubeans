'use client';

import { useEffect, useRef, useState } from 'react';
import { Calculator } from 'lucide-react';
import type { MetricNode } from '@/lib/api';
import { api } from '@/lib/api';
import {
  defaultSumDisplay,
  extractFormulaRefIds,
  FormulaError,
  formulaToDisplay,
  parseDisplayFormula,
} from '@/lib/monitoring/formula';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export function FormulaEditorDialog({
  metric,
  open,
  onOpenChange,
  onSaved,
}: {
  metric: MetricNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: {
    metricId: number;
    computeFormula: string | null;
    computeEnabled: boolean;
  }) => void;
}) {
  const children = metric?.children ?? [];
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expression, setExpression] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !metric) return;
    const kids = metric.children ?? [];
    setExpression(
      formulaToDisplay(metric.computeFormula, kids) ||
        defaultSumDisplay(kids),
    );
    setEnabled(!!metric.computeEnabled || !metric.computeFormula);
    setError(null);
  }, [open, metric]);

  if (!metric) return null;

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) {
      setExpression((prev) => `${prev}${text}`);
      return;
    }
    const start = el.selectionStart ?? expression.length;
    const end = el.selectionEnd ?? expression.length;
    const next = expression.slice(0, start) + text + expression.slice(end);
    setExpression(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSave = async () => {
    setError(null);
    let canonical: string | null = metric.computeFormula ?? null;
    if (expression.trim()) {
      try {
        canonical = parseDisplayFormula(expression, children).formula;
      } catch (e) {
        if (enabled) {
          setError(
            e instanceof FormulaError
              ? e.message
              : '계산식을 해석하지 못했습니다.',
          );
          return;
        }
      }
    } else {
      canonical = null;
    }
    if (enabled && !canonical) {
      setError('자동계산을 켜려면 계산식을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put<MetricNode>(
        `/metrics/${metric.metricId}`,
        {
          computeFormula: canonical,
          computeEnabled: enabled,
        },
      );
      onSaved({
        metricId: metric.metricId,
        computeFormula: data.computeFormula ?? canonical,
        computeEnabled: data.computeEnabled ?? enabled,
      });
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      const msg = err.response?.data?.message;
      setError(
        Array.isArray(msg) ? msg.join('\n') : (msg ?? '계산식 저장에 실패했습니다.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {metric.metricName} 자동계산
          </DialogTitle>
          <DialogDescription>
            하위지표를 사칙연산으로 묶어 조회 화면에 표시합니다. 하위지표를
            누르면 계산식에 들어갑니다.
          </DialogDescription>
        </DialogHeader>

        {metric.hasRawData ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            이 지표에 이미 업로드된 값이 있습니다. 자동계산을 켜면 monitoring
            화면에서는 하위지표 계산값이 우선 표시되고, 하위지표에 값이 없는
            연도·대상만 기존 값을 사용합니다. 원본 데이터는 삭제되지 않습니다.
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor="compute-enabled" className="text-sm font-medium">
            자동계산 사용
          </Label>
          <Switch
            id="compute-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            하위지표
          </div>
          {children.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              하위지표가 없습니다. 먼저 「하위」로 항목을 추가해 주세요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {children.map((c) => (
                <Button
                  key={c.metricId}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => insertAtCursor(`{${c.metricName}}`)}
                >
                  {c.metricName}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['+', '-', '*', '/', '(', ')'] as const).map((op) => (
            <Button
              key={op}
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 w-8 px-0 font-mono"
              onClick={() => insertAtCursor(` ${op} `)}
            >
              {op === '*' ? '×' : op === '/' ? '÷' : op}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs"
            onClick={() => setExpression(defaultSumDisplay(children))}
            disabled={children.length === 0}
          >
            하위지표 합산
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="compute-formula">계산식</Label>
          <Textarea
            id="compute-formula"
            ref={textareaRef}
            value={expression}
            onChange={(e) => {
              setExpression(e.target.value);
              setError(null);
            }}
            className="min-h-[88px] font-mono text-sm"
            placeholder="{항목A} + {항목B} 또는 ({항목A} / {항목B}) * 100"
          />
          {(() => {
            const missing = children.filter(
              (c) =>
                !extractFormulaRefIds(metric.computeFormula).includes(
                  c.metricId,
                ),
            );
            if (missing.length === 0 || !metric.computeFormula) return null;
            return (
              <p className="text-xs text-amber-800">
                계산식에 없는 하위지표: {missing.map((c) => c.metricName).join(', ')}.
                「하위지표 합산」으로 모두 더하거나 직접 넣어 주세요.
              </p>
            );
          })()}
          <p className="text-xs text-muted-foreground">
            예: <span className="font-mono">{'{취업자 수} / {졸업자 수} * 100'}</span>
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            취소
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
