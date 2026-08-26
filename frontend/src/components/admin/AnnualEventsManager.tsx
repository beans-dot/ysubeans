'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  api,
  ANNUAL_EVENT_CATEGORY_LABEL,
  type AnnualEvent,
  type AnnualEventCategory,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CATEGORIES: AnnualEventCategory[] = ['YSU', 'EXTERNAL'];

type FormState = {
  year: string;
  category: AnnualEventCategory;
  content: string;
};

const emptyForm = (): FormState => ({
  year: String(new Date().getFullYear()),
  category: 'YSU',
  content: '',
});

export function AnnualEventsManager() {
  const [events, setEvents] = useState<AnnualEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .get<AnnualEvent[]>('/annual-events')
      .then(({ data }) => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setLoaded(true));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!filterYear.trim()) return events;
    const y = Number.parseInt(filterYear, 10);
    if (!Number.isFinite(y)) return events;
    return events.filter((e) => e.year === y);
  }, [events, filterYear]);

  const grouped = useMemo(() => {
    const map = new Map<number, AnnualEvent[]>();
    for (const e of filtered) {
      const list = map.get(e.year) ?? [];
      list.push(e);
      map.set(e.year, list);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setError(null);
  };

  const startEdit = (event: AnnualEvent) => {
    setEditingId(event.eventId);
    setForm({
      year: String(event.year),
      category: event.category,
      content: event.content,
    });
    setError(null);
  };

  const handleSubmit = async () => {
    const year = Number.parseInt(form.year, 10);
    const content = form.content.trim();
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      setError('유효한 연도를 입력하세요.');
      return;
    }
    if (!content) {
      setError('변동사항 내용을 입력하세요.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const payload = { year, category: form.category, content };
      if (editingId != null) {
        await api.put(`/annual-events/${editingId}`, payload);
      } else {
        await api.post('/annual-events', payload);
      }
      resetForm();
      load();
    } catch {
      setError('저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (eventId: number) => {
    if (!window.confirm('이 변동사항을 삭제할까요?')) return;
    setBusy(true);
    try {
      await api.delete(`/annual-events/${eventId}`);
      if (editingId === eventId) resetForm();
      load();
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId != null ? '변동사항 수정' : '변동사항 추가'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="annual-year">연도</Label>
            <Input
              id="annual-year"
              type="number"
              min={1900}
              max={2100}
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>카테고리</Label>
            <div className="flex gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={
                    form.category === cat
                      ? 'rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground'
                      : 'rounded-md border border-input bg-background px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-accent'
                  }
                >
                  [{ANNUAL_EVENT_CATEGORY_LABEL[cat]}]
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="annual-content">내용</Label>
            <textarea
              id="annual-content"
              rows={6}
              value={form.content}
              onChange={(e) =>
                setForm((f) => ({ ...f, content: e.target.value }))
              }
              placeholder={
                '예:\n[학과] OO과(신설) / △△과(학과명 변경)\n[행정부서] □□팀(신설)'
              }
              className="flex w-full whitespace-pre-wrap rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={busy}>
              {editingId != null ? (
                <>
                  <Pencil className="mr-1 h-4 w-4" /> 수정 저장
                </>
              ) : (
                <>
                  <Plus className="mr-1 h-4 w-4" /> 추가
                </>
              )}
            </Button>
            {editingId != null && (
              <Button variant="outline" onClick={resetForm} disabled={busy}>
                취소
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">등록된 연간 변동사항</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-year" className="text-xs text-muted-foreground">
              연도 필터
            </Label>
            <Input
              id="filter-year"
              type="number"
              placeholder="전체"
              className="h-9 w-28"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!loaded && (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          )}
          {loaded && grouped.length === 0 && (
            <p className="text-sm text-muted-foreground">
              등록된 변동사항이 없습니다.
            </p>
          )}

          <div className="space-y-5">
            {grouped.map(([year, list]) => (
              <div key={year}>
                <h3 className="mb-2 text-sm font-bold text-foreground">
                  {year}년
                </h3>
                <ul className="space-y-2">
                  {list.map((event) => (
                    <li
                      key={event.eventId}
                      className="flex items-start gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <Badge
                        variant={
                          event.category === 'YSU' ? 'alimi' : 'internal'
                        }
                        className="mt-0.5 shrink-0"
                      >
                        [{ANNUAL_EVENT_CATEGORY_LABEL[event.category]}]
                      </Badge>
                      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed">
                        {event.content}
                      </p>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEdit(event)}
                          disabled={busy}
                          aria-label="수정"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(event.eventId)}
                          disabled={busy}
                          aria-label="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
