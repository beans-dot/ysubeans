'use client';

import { useEffect, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  useDashboardStore,
  type SelectedMetric,
  type SelectedTarget,
} from '@/store/useDashboardStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PresetItem {
  presetId: number;
  presetName: string;
  savedFilterJson: {
    selectedTargets: SelectedTarget[];
    selectedMetrics: SelectedMetric[];
    years: number[];
    chartOptions?: never;
  };
}

export function PresetManager() {
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const presetName = useDashboardStore((s) => s.presetName);
  const setPresetName = useDashboardStore((s) => s.setPresetName);
  const serialize = useDashboardStore((s) => s.serialize);
  const loadPresetState = useDashboardStore((s) => s.loadPresetState);
  const deletePreset = useDashboardStore((s) => s.deletePreset);
  const fetchPivot = useDashboardStore((s) => s.fetchPivot);

  const refresh = () => {
    api
      .get<PresetItem[]>('/presets')
      .then(({ data }) => setPresets(data))
      .catch(() => setPresets([]));
  };

  useEffect(refresh, []);

  const handleSave = async () => {
    if (!presetName.trim()) return;
    await api.post('/presets', {
      presetName: presetName.trim(),
      savedFilterJson: serialize(),
    });
    setPresetName('');
    refresh();
  };

  const handleLoad = async (id: number) => {
    const { data } = await api.get<PresetItem>(`/presets/${id}`);
    const json = data.savedFilterJson as PresetItem['savedFilterJson'];
    loadPresetState({
      selectedTargets: json.selectedTargets ?? [],
      selectedMetrics: json.selectedMetrics ?? [],
      years: json.years ?? [],
      chartOptions: json.chartOptions,
    });
    await fetchPivot();
  };

  const handleDelete = async (id: number) => {
    await deletePreset(id);
    refresh();
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="text-sm font-bold">프리셋</div>
      <div className="flex gap-2">
        <Input
          placeholder="프리셋 이름"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          className="h-9"
        />
        <Button size="sm" onClick={handleSave}>
          <Save className="mr-1 h-4 w-4" /> 저장
        </Button>
      </div>
      {presets.length > 0 && (
        <div className="flex flex-col gap-1 pt-1">
          {presets.map((p) => (
            <div
              key={p.presetId}
              className="flex items-center justify-between gap-2 rounded-md bg-secondary px-3 py-1.5"
            >
              <button
                type="button"
                onClick={() => handleLoad(p.presetId)}
                className="flex-1 truncate text-left text-xs font-bold hover:text-primary"
                title={p.presetName}
              >
                {p.presetName}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p.presetId)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                title="프리셋 삭제"
                aria-label="프리셋 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
