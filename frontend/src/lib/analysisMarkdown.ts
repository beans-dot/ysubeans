import type { PivotResult, PivotRow } from '@/lib/api';
import { formatNumber } from '@/lib/dataFormatters';
import {
  descriptiveStats,
  formatDescriptiveNumber,
  formatMode,
} from '@/lib/descriptiveStats';
import type { RelativeMetricGroup } from '@/lib/relativeCompare';
import type {
  AnalysisScope,
  SelectedMetric,
  SelectedTarget,
} from '@/store/useDashboardStore';

const STAT_HEADERS = [
  '평균(Mean)',
  '중앙값(Median)',
  '최빈값(Mode)',
  '분산(Variance)',
  '표준편차(Standard Deviation)',
  '범위(Range)',
  '사분위수(IQR)',
  '왜도(Skewness)',
  '첨도(Kurtosis)',
] as const;

export interface AnalysisMarkdownInput {
  screenTitle: string;
  pathname: string;
  scope: AnalysisScope;
  targets: SelectedTarget[];
  metrics: SelectedMetric[];
  years: number[];
  pivot: PivotResult;
  relativeScales: RelativeMetricGroup[];
  relativeExpand: { allSeries: boolean; allDepts: boolean };
  generatedAt?: Date;
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.map(cell).join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((row) => `| ${row.map((value) => cell(value)).join(' | ')} |`)
    .join('\n');
  return [head, rule, body].join('\n');
}

function onOff(value: boolean): string {
  return value ? '켜짐' : '꺼짐';
}

function seriesName(row: PivotRow): string {
  const unit = row.metricUnit?.trim();
  const name = `${row.targetLabel} · ${row.metricName}`;
  return unit ? `${name} (${unit})` : name;
}

function sortedYears(years: number[]): number[] {
  return [...years].sort((a, b) => a - b);
}

function valueText(value: number | null | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatNumber(value);
  }
  return '-';
}

function targetGroups(rows: PivotRow[]): Array<{ label: string; rows: PivotRow[] }> {
  const groups: Array<{ label: string; rows: PivotRow[] }> = [];
  const index = new Map<string, number>();
  for (const row of rows) {
    const key = row.targetKey;
    const found = index.get(key);
    if (found === undefined) {
      index.set(key, groups.length);
      groups.push({ label: row.targetLabel, rows: [row] });
    } else {
      groups[found].rows.push(row);
    }
  }
  return groups;
}

function roleLabel(
  scope: AnalysisScope,
  isFocus: boolean,
): string {
  if (scope === 'internal') return isFocus ? '대학 전체' : '계열·학과';
  return isFocus ? '연성대학교' : '비교 대학';
}

function querySection(input: AnalysisMarkdownInput): string {
  const years = sortedYears(input.years);
  const lines = [
    '## 조회 조건',
    '',
    `- 화면: ${input.screenTitle}`,
    `- 경로: ${input.pathname}`,
    `- 조회 기간: ${years.length ? years.join(', ') : '-'}`,
    '',
    '### 조회 대상',
    '',
  ];
  if (input.targets.length === 0) {
    lines.push('선택한 대상이 없습니다.');
  } else {
    for (const target of input.targets) {
      const kind =
        target.mode === 'group'
          ? '그룹 평균'
          : target.deptCode
            ? '학과'
            : '대학';
      const home = target.isYeonsung ? ', 연성대학교' : '';
      lines.push(`- ${target.label} (${kind}${home})`);
    }
  }
  lines.push('', '### 조회 지표', '');
  if (input.metrics.length === 0) {
    lines.push('선택한 지표가 없습니다.');
  } else {
    for (const metric of input.metrics) {
      const unit = metric.unit?.trim();
      lines.push(`- ${metric.metricName}${unit ? ` (단위: ${unit})` : ''}`);
    }
  }
  if (input.scope === 'internal') {
    lines.push(
      '',
      '### 상대비교 범위',
      '',
      `- 전체 계열 보기: ${onOff(input.relativeExpand.allSeries)}`,
      `- 전체 학과 보기: ${onOff(input.relativeExpand.allDepts)}`,
      '- 대학 평균은 상대비교에 항상 포함됩니다. 위 옵션이 켜져 있으면 화면에서 고른 대상과 관계없이 해당 위계 전체가 상대비교 표에 들어갑니다.',
    );
  }
  return lines.join('\n');
}

function rawSection(pivot: PivotResult): string {
  const years = sortedYears(pivot.years);
  const groups = targetGroups(pivot.rows);
  const lines = [
    '## 원 단위 데이터',
    '',
    '조회된 대상·지표의 연도별 원값입니다. 값이 없으면 "-"입니다.',
    '',
  ];
  if (groups.length === 0) {
    lines.push('조회된 원값이 없습니다.');
    return lines.join('\n');
  }
  for (const group of groups) {
    lines.push(`### ${group.label}`, '');
    lines.push(
      table(
        ['지표', '단위', ...years.map(String)],
        group.rows.map((row) => [
          row.metricName,
          row.metricUnit?.trim() || '-',
          ...years.map((year) => valueText(row.values[year])),
        ]),
      ),
      '',
    );
  }
  return lines.join('\n').trimEnd();
}

function trendSection(pivot: PivotResult): string {
  const years = sortedYears(pivot.years);
  const lines = [
    '## 추이',
    '',
    '같은 원값을 대상·지표별 시계열로 다시 적은 것입니다.',
    '',
  ];
  if (pivot.rows.length === 0) {
    lines.push('조회된 추이가 없습니다.');
    return lines.join('\n');
  }
  const groups = targetGroups(pivot.rows);
  for (const group of groups) {
    lines.push(`### ${group.label}`, '');
    for (const row of group.rows) {
      lines.push(`#### ${seriesName(row)}`, '');
      lines.push(
        table(
          ['연도', '값'],
          years.map((year) => [String(year), valueText(row.values[year])]),
        ),
        '',
      );
    }
  }
  return lines.join('\n').trimEnd();
}

function statsSection(pivot: PivotResult): string {
  const years = sortedYears(pivot.years);
  const lines = [
    '## 기초 기술 통계',
    '',
    `조회 기간(${years.join(', ') || '-'}) 중 값이 있는 연도로 계산합니다. 분산·표준편차·왜도·첨도는 그 연도 전체를 기준으로 하며, 첨도는 정규분포를 0으로 하는 초과첨도입니다. 최빈값은 같은 값이 두 번 이상일 때만 적습니다.`,
    '',
  ];
  const groups = targetGroups(pivot.rows);
  if (groups.length === 0) {
    lines.push('계산할 값이 없습니다.');
    return lines.join('\n');
  }
  for (const group of groups) {
    lines.push(`### ${group.label}`, '');
    lines.push(
      table(
        ['데이터명', ...STAT_HEADERS],
        group.rows.map((row) => {
          const stats = descriptiveStats(
            years.map((year) => row.values[year]),
          );
          return [
            seriesName(row),
            formatDescriptiveNumber(stats.mean),
            formatDescriptiveNumber(stats.median),
            formatMode(stats.modes),
            formatDescriptiveNumber(stats.variance),
            formatDescriptiveNumber(stats.stdev),
            formatDescriptiveNumber(stats.range),
            formatDescriptiveNumber(stats.iqr),
            formatDescriptiveNumber(stats.skewness),
            formatDescriptiveNumber(stats.kurtosis),
          ];
        }),
      ),
      '',
    );
  }
  return lines.join('\n').trimEnd();
}

function relativeSection(input: AnalysisMarkdownInput): string {
  const lines = [
    '## 상대비교',
    '',
    '각 연도의 비교군 평균을 상대위치 50, 그 연도 최솟값을 0, 최댓값을 100으로 둔 값입니다. 원값은 그 연도의 실제 수치입니다. 표에 있는 대상이 그 비교군의 전부입니다.',
    '',
  ];
  if (input.relativeScales.length === 0) {
    lines.push('상대비교 결과가 없습니다.');
    return lines.join('\n');
  }
  for (const group of input.relativeScales) {
    const unit = group.metricUnit?.trim();
    lines.push(
      `### ${group.metricName}${unit ? ` (단위: ${unit})` : ''}`,
      '',
    );
    for (const scale of group.scales) {
      const ranked = [...scale.universities].sort((a, b) => {
        if (a.value !== b.value) return b.value - a.value;
        return a.label.localeCompare(b.label, 'ko');
      });
      const values = scale.universities.map((item) => item.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      lines.push(
        `#### ${scale.year}년`,
        '',
        `- 비교군 평균: ${formatNumber(scale.mean)}`,
        `- 최솟값: ${formatNumber(min)}`,
        `- 최댓값: ${formatNumber(max)}`,
        `- 대상 수: ${scale.universities.length}`,
        '',
        table(
          ['대상', '원값', '상대위치', '구분'],
          ranked.map((item) => [
            item.label,
            formatNumber(item.value),
            formatNumber(item.position),
            roleLabel(input.scope, item.isYeonsung),
          ]),
        ),
        '',
      );
    }
  }
  return lines.join('\n').trimEnd();
}

export function buildAnalysisMarkdown(input: AnalysisMarkdownInput): string {
  const generated = input.generatedAt ?? new Date();
  const stamped = generated.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const returned = new Set(input.pivot.rows.map((row) => row.targetLabel));
  const missing = input.targets.filter((target) => !returned.has(target.label));
  const sections = [
    `# ${input.screenTitle}`,
    '',
    `작성 시각: ${stamped} (Asia/Seoul)`,
    '',
    '화면에서 조회한 정량 데이터를 그대로 옮긴 파일입니다. 없는 값은 "-"입니다.',
    '',
    querySection(input),
    '',
    rawSection(input.pivot),
    '',
    trendSection(input.pivot),
    '',
    statsSection(input.pivot),
    '',
    relativeSection(input),
  ];
  if (missing.length > 0) {
    sections.push(
      '',
      '## 값이 없는 조회 대상',
      '',
      '선택했지만 원 단위 데이터에 행이 없는 대상입니다.',
      '',
      ...missing.map((target) => `- ${target.label}`),
    );
  }
  sections.push('');
  return sections.join('\n');
}

export function analysisMarkdownFilename(
  scope: AnalysisScope,
  at: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const stamp = `${pick('year')}${pick('month')}${pick('day')}-${pick('hour')}${pick('minute')}`;
  const scopeName = scope === 'internal' ? 'competitiveness' : 'disclosure';
  return `ysu-ir-${scopeName}-${stamp}.md`;
}
