import type { MetricSourceType } from '../../entities';

export const METRIC_SOURCE_TYPES: MetricSourceType[] = [
  'ALIMI',
  'INTERNAL',
  'MONITORING',
];

export function parseMetricSourceType(
  raw?: string | null,
): MetricSourceType | undefined {
  if (raw === 'ALIMI' || raw === 'INTERNAL' || raw === 'MONITORING') {
    return raw;
  }
  return undefined;
}

export function coerceMetricSourceType(
  raw?: string | null,
): MetricSourceType {
  return parseMetricSourceType(raw) ?? 'ALIMI';
}

export function sourceTypeLabel(sourceType: MetricSourceType): string {
  if (sourceType === 'ALIMI') return '공시';
  if (sourceType === 'INTERNAL') return '자체';
  return '모니터링';
}
