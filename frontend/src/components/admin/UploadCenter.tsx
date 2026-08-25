'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  School,
  Search,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  api,
  type MetricCodebook,
  type MetricCodebookEntry,
  type UniversityCodebook,
} from '@/lib/api';
import { logDataExport } from '@/lib/exportLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type UploadResult =
  | {
      status: 'SUCCESS';
      inserted: number;
      updated: number;
      metricsCreated?: number;
    }
  | {
      status: 'NEED_CONFIRM_OVERWRITE';
      message: string;
      conflictCount: number;
      samples: string[];
    }
  | { status: 'NEED_CONFIRM_LOCKED'; message: string; lockedYears: number[] };

type CodebookTab =
  | 'ysu'
  | 'univ'
  | 'dept'
  | 'metric-alimi'
  | 'metric-internal'
  | 'metric-monitoring';
type TemplateKind = 'empty' | 'campus';
type UploadMode = 'internal' | 'monitoring';

const TEMPLATE_HEADERS_EMPTY = [
  'year',
  'univ_code',
  'dept_code',
  'metric_name',
  'metric_value',
] as const;

const TEMPLATE_HEADERS_CAMPUS = [
  'year',
  'univ_code',
  'univ_name',
  'dept_code',
  'dept_name',
  'metric_name',
  'metric_value',
] as const;

const COLUMN_GUIDE: Array<{
  header: string;
  required: string;
  meaning: string;
  example: string;
}> = [
  {
    header: 'year',
    required: '필수',
    meaning: '실적 연도(정수). 해당 지표 값의 기준 연도입니다.',
    example: '2026',
  },
  {
    header: 'univ_code',
    required: '필수',
    meaning:
      '대학 코드. 빈 양식·교내 데이터 양식 모두 연성대학교 코드가 기본 입력됩니다. 타 대학은 코드북을 참고하세요.',
    example: '0002651',
  },
  {
    header: 'dept_code',
    required: '선택',
    meaning:
      '학과 코드. 양식에 연성대 자체 편제 학과가 나열됩니다. 대학 전체 지표는 _ALL_ 을 사용합니다.',
    example: '_ALL_',
  },
  {
    header: 'metric_name',
    required: '필수',
    meaning:
      '지표명(텍스트). 기존 지표는 코드북의 metric_name을 그대로 복사하세요. 신규면 자체 지표로 등록되며 metric_id는 시스템이 자동 할당합니다. 오타·띄어쓰기 차이는 별도 지표로 생성됩니다.',
    example: '재학생수',
  },
  {
    header: 'metric_value',
    required: '필수',
    meaning:
      '지표 값. 빈칸은 거부됩니다. 없으면 NULL, 숫자 0은 허용. metric_name·metric_value가 모두 비어 있는 행은 업로드 시 무시됩니다.',
    example: '12.5 또는 NULL 또는 0',
  },
];

async function fetchUnivCodebook(): Promise<UniversityCodebook> {
  const { data } = await api.get<UniversityCodebook>('/universities/codebook');
  return data;
}

async function fetchMetricCodebook(): Promise<MetricCodebook> {
  const { data } = await api.get<MetricCodebook>('/metrics/codebook');
  return data;
}

function buildUploadTemplateWorkbook(
  codebook: UniversityCodebook,
  metrics: MetricCodebookEntry[],
  kind: TemplateKind,
  mode: UploadMode = 'internal',
) {
  const year = codebook.referenceYear;
  const { univCode, univName, departments } = codebook.yeonsung;
  const campusUnivName = univName || '연성대학교';

  const dataRows: Array<Array<string | number>> =
    kind === 'campus'
      ? [
          [...TEMPLATE_HEADERS_CAMPUS],
          [year, univCode, campusUnivName, '_ALL_', '대학 전체', '', ''],
          ...departments.map(
            (d) =>
              [
                year,
                univCode,
                campusUnivName,
                d.deptCode,
                d.deptName,
                '',
                '',
              ] as Array<string | number>,
          ),
        ]
      : [
          [...TEMPLATE_HEADERS_EMPTY],
          [year, univCode, '_ALL_', '', ''],
          ...departments.map((d) => [year, univCode, d.deptCode, '', ''] as Array<
            string | number
          >),
        ];
  const dataSheet = XLSX.utils.aoa_to_sheet(dataRows);
  dataSheet['!cols'] =
    kind === 'campus'
      ? [
          { wch: 10 },
          { wch: 14 },
          { wch: 16 },
          { wch: 16 },
          { wch: 28 },
          { wch: 28 },
          { wch: 14 },
        ]
      : [
          { wch: 10 },
          { wch: 14 },
          { wch: 16 },
          { wch: 28 },
          { wch: 14 },
        ];

  const ysuSheet = XLSX.utils.aoa_to_sheet([
    ['univ_code', 'univ_name', 'dept_code', 'dept_name', 'series_lg', '비고'],
    [univCode, univName, '_ALL_', '대학 전체', '', '학과 구분 없는 대학 단위 지표'],
    ...departments.map((d) => [
      univCode,
      univName,
      d.deptCode,
      d.deptName,
      d.seriesLg ?? '',
      '조회 대상(활성) 학과',
    ]),
  ]);
  ysuSheet['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
    { wch: 28 },
  ];

  const alimiMetrics = metrics.filter((m) => m.sourceType === 'ALIMI');
  const internalMetrics = metrics.filter((m) => m.sourceType === 'INTERNAL');
  const monitoringMetrics = metrics.filter(
    (m) => m.sourceType === 'MONITORING',
  );
  const metricHeaders = [
    'metric_id',
    'metric_name',
    'source',
    'category_name',
    'parent_metric_name',
    'metric_unit',
  ];
  const toMetricRow = (m: MetricCodebookEntry) => [
    m.metricId,
    m.metricName,
    m.sourceLabel,
    m.categoryName,
    m.parentMetricName ?? '',
    m.metricUnit ?? '',
  ];

  const alimiSheet = XLSX.utils.aoa_to_sheet([
    metricHeaders,
    ...alimiMetrics.map(toMetricRow),
  ]);
  alimiSheet['!cols'] = [
    { wch: 12 },
    { wch: 36 },
    { wch: 8 },
    { wch: 20 },
    { wch: 24 },
    { wch: 12 },
  ];

  const internalSheet = XLSX.utils.aoa_to_sheet([
    metricHeaders,
    ...internalMetrics.map(toMetricRow),
  ]);
  internalSheet['!cols'] = [
    { wch: 12 },
    { wch: 36 },
    { wch: 8 },
    { wch: 20 },
    { wch: 24 },
    { wch: 12 },
  ];

  const monitoringSheet = XLSX.utils.aoa_to_sheet([
    metricHeaders,
    ...monitoringMetrics.map(toMetricRow),
  ]);
  monitoringSheet['!cols'] = internalSheet['!cols'];

  const campusGuide =
    kind === 'campus'
      ? [
          ['univ_name', '표시용', 'univ_code에 대응하는 대학명. 업로드 시 무시됩니다.', campusUnivName],
          ['dept_name', '표시용', 'dept_code에 대응하는 학과명. 업로드 시 무시됩니다.', '컴퓨터소프트웨어과'],
        ]
      : [];
  const guideNotes =
    kind === 'campus'
      ? [
          [
            `교내 데이터 양식은 ${campusUnivName}(${univCode}) 전용입니다. 당해 연도(${year}) 기준 자체 편제 학과를 미리 채웁니다.`,
          ],
          [
            'univ_name, dept_name 열은 식별용 더미입니다. 업로드 시 무시되며, 적재는 univ_code / dept_code만 사용합니다.',
          ],
          [
            'metric_name / metric_value 만 입력하면 됩니다. 둘 다 비어 있는 행은 업로드 시 건너뜁니다.',
          ],
          [
            mode === 'monitoring'
              ? '지표명을 바꾼 뒤에는 이 양식을 다시 받으세요. 「지표코드(모니터링)」시트의 현재 metric_id–metric_name을 복사하세요. 예전 이름으로 올리면 신규 지표가 생깁니다. 수입·지출처럼 이름이 겹치면 metric_id를 함께 넣으세요.'
              : '지표명을 바꾼 뒤에는 이 양식을 다시 받으세요. 「지표코드(자체)」시트의 현재 metric_id–metric_name을 복사하세요. 예전 이름으로 올리면 신규 지표가 생깁니다.',
          ],
          [
            '첫 행에서 year/univ_code/dept_code/metric_name/metric_value 헤더만 처리합니다. univ_name·dept_name·메모 등 기타 열은 무시됩니다.',
          ],
        ]
      : [
          [
            `업로드양식 시트는 ${univName}(${univCode})의 당해 연도(${year}) 기준 활성 학과를 미리 채웁니다.`,
          ],
          [
            'metric_name / metric_value 만 입력하면 됩니다. 둘 다 비어 있는 행은 업로드 시 건너뜁니다.',
          ],
          [
            '기존 지표는 「지표코드(공시)」「지표코드(자체)」시트의 metric_name을 그대로 복사하세요. 오타·띄어쓰기는 신규 지표로 등록됩니다.',
          ],
          [
            '첫 행 헤더가 year/univ_code/dept_code/metric_name/metric_value 인 열만 처리합니다. 메모·비고 등 기타 열은 무시됩니다.',
          ],
        ];
  const guideSheet = XLSX.utils.aoa_to_sheet([
    ['컬럼명', '필수여부', '설명', '예시'],
    ...COLUMN_GUIDE.map((c) => [c.header, c.required, c.meaning, c.example]),
    ...campusGuide,
    [],
    ['참고'],
    ...guideNotes,
  ]);
  guideSheet['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 80 }, { wch: 28 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, '업로드양식');
  XLSX.utils.book_append_sheet(workbook, ysuSheet, '연성대학과목록');
  if (mode === 'monitoring') {
    XLSX.utils.book_append_sheet(workbook, monitoringSheet, '지표코드(모니터링)');
  } else {
    XLSX.utils.book_append_sheet(workbook, alimiSheet, '지표코드(공시)');
    XLSX.utils.book_append_sheet(workbook, internalSheet, '지표코드(자체)');
  }
  XLSX.utils.book_append_sheet(workbook, guideSheet, '컬럼설명');
  return workbook;
}

function buildCodebookWorkbook(
  codebook: UniversityCodebook,
  metricCodebook: MetricCodebook,
  mode: UploadMode = 'internal',
) {
  const univSheet = XLSX.utils.aoa_to_sheet([
    ['univ_code', 'univ_name', 'school_type', 'region_type', 'region_city'],
    ...codebook.universities.map((u) => [
      u.univCode,
      u.univName,
      u.schoolType ?? '',
      u.regionType ?? '',
      u.regionCity ?? '',
    ]),
  ]);
  univSheet['!cols'] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];

  const deptSheet = XLSX.utils.aoa_to_sheet([
    ['univ_code', 'univ_name', 'dept_code', 'dept_name', 'series_lg'],
    ...codebook.departments.map((d) => [
      d.univCode,
      d.univName,
      d.deptCode,
      d.deptName,
      d.seriesLg ?? '',
    ]),
  ]);
  deptSheet['!cols'] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
  ];

  const alimiMetrics = metricCodebook.metrics.filter(
    (m) => m.sourceType === 'ALIMI',
  );
  const internalMetrics = metricCodebook.metrics.filter(
    (m) => m.sourceType === 'INTERNAL',
  );
  const monitoringMetrics = metricCodebook.metrics.filter(
    (m) => m.sourceType === 'MONITORING',
  );
  const metricHeaders = [
    'metric_id',
    'metric_name',
    'source',
    'category_name',
    'parent_metric_name',
    'metric_unit',
  ];
  const toMetricRow = (m: MetricCodebookEntry) => [
    m.metricId,
    m.metricName,
    m.sourceLabel,
    m.categoryName,
    m.parentMetricName ?? '',
    m.metricUnit ?? '',
  ];

  const alimiSheet = XLSX.utils.aoa_to_sheet([
    metricHeaders,
    ...alimiMetrics.map(toMetricRow),
  ]);
  alimiSheet['!cols'] = [
    { wch: 12 },
    { wch: 36 },
    { wch: 8 },
    { wch: 20 },
    { wch: 24 },
    { wch: 12 },
  ];

  const internalSheet = XLSX.utils.aoa_to_sheet([
    metricHeaders,
    ...internalMetrics.map(toMetricRow),
  ]);
  internalSheet['!cols'] = [
    { wch: 12 },
    { wch: 36 },
    { wch: 8 },
    { wch: 20 },
    { wch: 24 },
    { wch: 12 },
  ];

  const monitoringSheet = XLSX.utils.aoa_to_sheet([
    metricHeaders,
    ...monitoringMetrics.map(toMetricRow),
  ]);
  monitoringSheet['!cols'] = internalSheet['!cols'];

  const metaSheet = XLSX.utils.aoa_to_sheet(
    mode === 'monitoring'
      ? [
          ['항목', '값'],
          ['생성시각(UTC)', codebook.generatedAt],
          ['기준연도', codebook.referenceYear],
          ['모니터링 지표 수', monitoringMetrics.length],
          [
            '연성대',
            `${codebook.yeonsung.univName} (${codebook.yeonsung.univCode}) / 학과 ${codebook.yeonsung.departments.length}개`,
          ],
          [],
          [
            '안내',
            '지표 코드북은 현재 DB의 metric_id–metric_name입니다. 지표 DB 빌더에서 이름을 바꾼 뒤에도 이 파일을 다시 받으면 최신 매핑이 들어갑니다. 업로드 시 현재 metric_name을 쓰고, 이름이 겹치면 metric_id를 함께 넣으세요.',
          ],
        ]
      : [
          ['항목', '값'],
          ['생성시각(UTC)', codebook.generatedAt],
          ['기준연도(알리미 배치 당해)', codebook.referenceYear],
          ['대학 수', codebook.universities.length],
          ['활성 학과 수', codebook.departments.length],
          ['공시 지표 수', alimiMetrics.length],
          ['자체 지표 수', internalMetrics.length],
          [
            '연성대',
            `${codebook.yeonsung.univName} (${codebook.yeonsung.univCode}) / 학과 ${codebook.yeonsung.departments.length}개`,
          ],
          [],
          [
            '안내',
            '대학·학과·지표 코드는 DB 실시간 조회입니다. 지표 DB 빌더에서 지표명을 바꾼 뒤에도 이 파일을 다시 받으면 최신 metric_id–metric_name이 들어갑니다.',
          ],
        ],
  );
  metaSheet['!cols'] = [{ wch: 28 }, { wch: 90 }];

  const ysuDeptSheet = XLSX.utils.aoa_to_sheet([
    ['univ_code', 'univ_name', 'dept_code', 'dept_name', 'series_lg'],
    [
      codebook.yeonsung.univCode,
      codebook.yeonsung.univName,
      '_ALL_',
      '대학 전체',
      '',
    ],
    ...codebook.yeonsung.departments.map((d) => [
      codebook.yeonsung.univCode,
      codebook.yeonsung.univName,
      d.deptCode,
      d.deptName,
      d.seriesLg ?? '',
    ]),
  ]);
  ysuDeptSheet['!cols'] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, metaSheet, '안내');
  if (mode === 'monitoring') {
    XLSX.utils.book_append_sheet(workbook, ysuDeptSheet, '연성대학과목록');
    XLSX.utils.book_append_sheet(workbook, monitoringSheet, '지표코드(모니터링)');
  } else {
    XLSX.utils.book_append_sheet(workbook, univSheet, '대학코드');
    XLSX.utils.book_append_sheet(workbook, deptSheet, '학과코드');
    XLSX.utils.book_append_sheet(workbook, alimiSheet, '지표코드(공시)');
    XLSX.utils.book_append_sheet(workbook, internalSheet, '지표코드(자체)');
  }
  return workbook;
}

export function UploadCenter() {
  return (
    <div className="space-y-6">
      <ExcelUploadPanel mode="internal" />
      <ExcelUploadPanel mode="monitoring" />
    </div>
  );
}

function ExcelUploadPanel({ mode }: { mode: UploadMode }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [confirmLocked, setConfirmLocked] = useState(false);
  const [downloading, setDownloading] = useState<'template' | 'codebook' | null>(
    null,
  );
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [codebookOpen, setCodebookOpen] = useState(false);
  const [codebook, setCodebook] = useState<UniversityCodebook | null>(null);
  const [metricCodebook, setMetricCodebook] = useState<MetricCodebook | null>(
    null,
  );
  const [codebookLoading, setCodebookLoading] = useState(false);
  const [codebookError, setCodebookError] = useState<string | null>(null);
  const [codebookQuery, setCodebookQuery] = useState('');
  const [codebookTab, setCodebookTab] = useState<CodebookTab>('ysu');

  const doUpload = async (opts: {
    confirmOverwrite: boolean;
    confirmLocked: boolean;
  }) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<UploadResult>('/upload/excel', form, {
        params: {
          ...opts,
          sourceType: mode === 'monitoring' ? 'MONITORING' : 'INTERNAL',
        },
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      if (data.status === 'SUCCESS') {
        setConfirmOverwrite(false);
        setConfirmLocked(false);
        window.dispatchEvent(new Event('ir-metrics-changed'));
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? '업로드 실패');
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const handleInitialUpload = () => {
    setConfirmOverwrite(false);
    setConfirmLocked(false);
    doUpload({ confirmOverwrite: false, confirmLocked: false });
  };

  const handleDownloadTemplate = async (kind: TemplateKind) => {
    setTemplatePickerOpen(false);
    setDownloading('template');
    setError(null);
    try {
      const [univ, metrics] = await Promise.all([
        fetchUnivCodebook(),
        fetchMetricCodebook(),
      ]);
      const wb = buildUploadTemplateWorkbook(
        univ,
        metrics.metrics,
        kind,
        mode,
      );
      const filename =
        mode === 'monitoring'
          ? `ysu-ir-monitoring-upload-template-${univ.referenceYear}.xlsx`
          : kind === 'campus'
            ? `ysu-ir-upload-campus-template-${univ.referenceYear}.xlsx`
            : `ysu-ir-upload-template-${univ.referenceYear}.xlsx`;
      XLSX.writeFile(wb, filename);
      logDataExport({
        format: 'xlsx',
        source: 'upload-template',
        filename,
        summary:
          mode === 'monitoring'
            ? '모니터링 업로드 양식'
            : kind === 'campus'
              ? '캠퍼스 업로드 양식'
              : '자체 데이터 업로드 양식',
      });
    } catch {
      setError('샘플 양식 생성 실패 (코드 조회 오류)');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadCodebook = async () => {
    setDownloading('codebook');
    setError(null);
    try {
      const [univ, metrics] = await Promise.all([
        fetchUnivCodebook(),
        fetchMetricCodebook(),
      ]);
      const wb = buildCodebookWorkbook(univ, metrics, mode);
      const filename =
        mode === 'monitoring'
          ? `ysu-ir-monitoring-codebook-${univ.referenceYear}.xlsx`
          : `ysu-ir-codebook-${univ.referenceYear}.xlsx`;
      XLSX.writeFile(wb, filename);
      logDataExport({
        format: 'xlsx',
        source: 'upload-codebook',
        filename,
        summary:
          mode === 'monitoring' ? '모니터링 코드북' : '자체 데이터 코드북',
      });
    } catch {
      setError('코드북 다운로드 실패');
    } finally {
      setDownloading(null);
    }
  };

  const openCodebook = async () => {
    setCodebookOpen(true);
    setCodebookLoading(true);
    setCodebookError(null);
    setCodebookQuery('');
    try {
      const [univ, metrics] = await Promise.all([
        fetchUnivCodebook(),
        fetchMetricCodebook(),
      ]);
      setCodebook(univ);
      setMetricCodebook(metrics);
    } catch {
      setCodebook(null);
      setMetricCodebook(null);
      setCodebookError('코드북을 불러오지 못했습니다.');
    } finally {
      setCodebookLoading(false);
    }
  };

  const filteredUnivs = useMemo(() => {
    if (!codebook) return [];
    const q = codebookQuery.trim().toLowerCase();
    if (!q) return codebook.universities.slice(0, 200);
    return codebook.universities
      .filter(
        (u) =>
          u.univCode.toLowerCase().includes(q) ||
          u.univName.toLowerCase().includes(q) ||
          (u.regionCity ?? '').toLowerCase().includes(q),
      )
      .slice(0, 200);
  }, [codebook, codebookQuery]);

  const filteredDepts = useMemo(() => {
    if (!codebook) return [];
    const q = codebookQuery.trim().toLowerCase();
    const source =
      codebookTab === 'ysu'
        ? codebook.departments.filter(
            (d) => d.univCode === codebook.yeonsung.univCode,
          )
        : codebook.departments;
    if (!q) return source.slice(0, 300);
    return source
      .filter(
        (d) =>
          d.univCode.toLowerCase().includes(q) ||
          d.univName.toLowerCase().includes(q) ||
          d.deptCode.toLowerCase().includes(q) ||
          d.deptName.toLowerCase().includes(q) ||
          (d.seriesLg ?? '').toLowerCase().includes(q),
      )
      .slice(0, 300);
  }, [codebook, codebookQuery, codebookTab]);

  const filteredMetrics = useMemo(() => {
    if (!metricCodebook) return [];
    const sourceType =
      codebookTab === 'metric-alimi'
        ? 'ALIMI'
        : codebookTab === 'metric-monitoring'
          ? 'MONITORING'
          : 'INTERNAL';
    const source = metricCodebook.metrics.filter(
      (m) => m.sourceType === sourceType,
    );
    const q = codebookQuery.trim().toLowerCase();
    if (!q) return source.slice(0, 400);
    return source
      .filter(
        (m) =>
          String(m.metricId).includes(q) ||
          m.metricName.toLowerCase().includes(q) ||
          m.categoryName.toLowerCase().includes(q) ||
          (m.metricUnit ?? '').toLowerCase().includes(q),
      )
      .slice(0, 400);
  }, [metricCodebook, codebookQuery, codebookTab]);

  const alimiCount =
    metricCodebook?.metrics.filter((m) => m.sourceType === 'ALIMI').length ?? 0;
  const internalCount =
    metricCodebook?.metrics.filter((m) => m.sourceType === 'INTERNAL').length ??
    0;

  const monitoringCount =
    metricCodebook?.metrics.filter((m) => m.sourceType === 'MONITORING')
      .length ?? 0;
  const isMonitoring = mode === 'monitoring';

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isMonitoring
            ? '모니터링 데이터 업로드'
            : '자체 데이터 엑셀 업로드'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            헤더:{' '}
            <code>
              year, univ_code, dept_code, metric_name, metric_value
            </code>
          </p>
          {isMonitoring ? (
            <>
              <p>
                대학주요모니터링 전용입니다. 양식·코드북은 연성대학교 학과(계열)
                편제와 모니터링 지표만 포함합니다. 교내 데이터 양식과 같이{' '}
                <code>univ_code</code> 옆에 대학명, <code>dept_code</code> 옆에
                학과명이 붙습니다. 한글 열은 업로드 시 무시됩니다.
              </p>
              <p>
                기존 지표는 모니터링 코드북의 <code>metric_name</code>을 그대로
                복사하세요. 수입·지출처럼 이름이 겹치면 <code>metric_id</code>를
                함께 넣으세요. 신규 이름은 모니터링 「분류없음」으로 등록됩니다.
              </p>
            </>
          ) : (
            <>
              <p>
                「양식 다운로드」에서 빈 양식 또는 교내 데이터 양식을 고를 수
                있습니다. 빈 양식은 코드만 채운 기존 형식입니다. 교내 데이터
                양식은 연성대학교 전용이며 <code>univ_code</code> 옆에 대학명,{' '}
                <code>dept_code</code> 옆에 학과명이 붙습니다. 한글 열은 업로드
                시 무시됩니다.
              </p>
              <p>
                기존 지표는 코드북의 <code>metric_name</code>을 그대로
                복사하세요. 신규 <code>metric_name</code>은 「분류없음」에 자체
                지표로 등록되며, <code>metric_id</code>는 시스템이 자동
                할당합니다.
              </p>
            </>
          )}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-bold text-foreground">컬럼 안내</div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {COLUMN_GUIDE.map((c) => (
              <li key={c.header}>
                <span className="font-bold text-foreground">{c.header}</span>
                <span className="mx-1">({c.required})</span>— {c.meaning}
              </li>
            ))}
            <li>
              <span className="font-bold text-foreground">univ_name</span>
              <span className="mx-1">(표시용)</span>— 교내 데이터 양식에서
              univ_code 우측. 연성대학교. 업로드 시 무시됩니다.
            </li>
            <li>
              <span className="font-bold text-foreground">dept_name</span>
              <span className="mx-1">(표시용)</span>— 교내 데이터 양식에서
              dept_code 우측. 코드에 대응하는 학과명. 업로드 시 무시됩니다.
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              isMonitoring
                ? void handleDownloadTemplate('campus')
                : setTemplatePickerOpen(true)
            }
            disabled={!!downloading}
          >
            <Download className="mr-1 h-4 w-4" />
            {downloading === 'template' ? '양식 생성 중…' : '양식 다운로드'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadCodebook}
            disabled={!!downloading}
          >
            <Download className="mr-1 h-4 w-4" />
            {downloading === 'codebook' ? '코드북 생성 중…' : '코드북 다운로드'}
          </Button>
          <Button type="button" variant="secondary" onClick={openCodebook}>
            <BookOpen className="mr-1 h-4 w-4" /> 코드북 조회
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
            className="text-sm"
          />
          <Button onClick={handleInitialUpload} disabled={!file || busy}>
            <Upload className="mr-1 h-4 w-4" /> 업로드
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result?.status === 'NEED_CONFIRM_OVERWRITE' && (
          <div className="space-y-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" /> 덮어쓰기 확인
            </div>
            <p>{result.message}</p>
            <ul className="list-disc pl-5 text-xs">
              {result.samples.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setConfirmOverwrite(true);
                  doUpload({ confirmOverwrite: true, confirmLocked });
                }}
              >
                덮어쓰기
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResult(null)}
              >
                취소
              </Button>
            </div>
          </div>
        )}

        {result?.status === 'NEED_CONFIRM_LOCKED' && (
          <div className="space-y-2 rounded-md bg-red-50 p-3 text-sm text-red-900">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" /> 마감(잠금) 데이터 경고
            </div>
            <p>{result.message}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setConfirmLocked(true);
                  doUpload({ confirmOverwrite: true, confirmLocked: true });
                }}
              >
                잠금 무시하고 수정
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResult(null)}
              >
                취소
              </Button>
            </div>
          </div>
        )}

        {result?.status === 'SUCCESS' && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            업로드 완료: 신규 {result.inserted}건, 갱신 {result.updated}건
            {typeof result.metricsCreated === 'number' &&
            result.metricsCreated > 0
              ? `, 신규 지표 ${result.metricsCreated}개 → 「분류없음」`
              : ''}
            .
          </div>
        )}
      </CardContent>

      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>양식 다운로드</DialogTitle>
            <DialogDescription>
              받을 양식을 선택하세요. 두 양식 모두 업로드 시 인식하는 열은
              year, univ_code, dept_code, metric_name, metric_value 입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <button
              type="button"
              className="flex items-start gap-3 rounded-md border p-4 text-left transition-colors hover:bg-accent"
              disabled={!!downloading}
              onClick={() => void handleDownloadTemplate('empty')}
            >
              <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <span>
                <span className="block font-bold text-foreground">빈 양식</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  기존과 동일합니다. 코드만 채워져 있고 지표값은 비어 있습니다.
                </span>
              </span>
            </button>
            <button
              type="button"
              className="flex items-start gap-3 rounded-md border p-4 text-left transition-colors hover:bg-accent"
              disabled={!!downloading}
              onClick={() => void handleDownloadTemplate('campus')}
            >
              <School className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <span>
                <span className="block font-bold text-foreground">
                  교내 데이터 양식
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  연성대학교 전용입니다. univ_code 옆에 대학명(연성대학교),
                  dept_code 옆에 학과명이 붙습니다. 한글 열은 업로드 시
                  무시됩니다.
                </span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={codebookOpen} onOpenChange={setCodebookOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {isMonitoring
                ? '연성대 모니터링 코드북'
                : '대학·학과·지표 코드북'}
            </DialogTitle>
            <DialogDescription>
              {isMonitoring
                ? '연성대학교 학과와 모니터링 지표만 보여 줍니다. metric_name을 그대로 복사해 업로드하세요.'
                : 'DB 실시간 조회입니다. 기존 지표는 metric_name을 그대로 복사해 업로드하세요.'}
              {codebook && metricCodebook && (
                <>
                  {' '}
                  {isMonitoring
                    ? `기준연도 ${codebook.referenceYear} · 연성대 학과 ${codebook.yeonsung.departments.length} · 모니터링 ${monitoringCount}`
                    : `기준연도 ${codebook.referenceYear} · 대학 ${codebook.universities.length} · 학과 ${codebook.departments.length} · 공시 ${alimiCount} · 자체 ${internalCount}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={codebookTab === 'ysu' ? 'default' : 'outline'}
              onClick={() => setCodebookTab('ysu')}
            >
              연성대 학과
            </Button>
            {!isMonitoring && (
              <>
                <Button
                  size="sm"
                  variant={codebookTab === 'univ' ? 'default' : 'outline'}
                  onClick={() => setCodebookTab('univ')}
                >
                  전체 대학
                </Button>
                <Button
                  size="sm"
                  variant={codebookTab === 'dept' ? 'default' : 'outline'}
                  onClick={() => setCodebookTab('dept')}
                >
                  전체 학과
                </Button>
                <Button
                  size="sm"
                  variant={codebookTab === 'metric-alimi' ? 'default' : 'outline'}
                  onClick={() => setCodebookTab('metric-alimi')}
                >
                  지표(공시)
                </Button>
                <Button
                  size="sm"
                  variant={
                    codebookTab === 'metric-internal' ? 'default' : 'outline'
                  }
                  onClick={() => setCodebookTab('metric-internal')}
                >
                  지표(자체)
                </Button>
              </>
            )}
            {isMonitoring && (
              <Button
                size="sm"
                variant={
                  codebookTab === 'metric-monitoring' ? 'default' : 'outline'
                }
                onClick={() => setCodebookTab('metric-monitoring')}
              >
                지표(모니터링)
              </Button>
            )}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-9 pl-8"
                placeholder="코드/이름 검색"
                value={codebookQuery}
                onChange={(e) => setCodebookQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[50vh] overflow-auto rounded-md border">
            {codebookLoading && (
              <p className="p-4 text-sm text-muted-foreground">불러오는 중…</p>
            )}
            {codebookError && (
              <p className="p-4 text-sm text-destructive">{codebookError}</p>
            )}
            {!codebookLoading && codebook && codebookTab === 'univ' && (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5">univ_code</th>
                    <th className="px-2 py-1.5">univ_name</th>
                    <th className="px-2 py-1.5">학교종류</th>
                    <th className="px-2 py-1.5">권역</th>
                    <th className="px-2 py-1.5">지역</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnivs.map((u) => (
                    <tr key={u.univCode} className="border-t">
                      <td className="px-2 py-1 font-mono">{u.univCode}</td>
                      <td className="px-2 py-1">{u.univName}</td>
                      <td className="px-2 py-1">{u.schoolType}</td>
                      <td className="px-2 py-1">{u.regionType}</td>
                      <td className="px-2 py-1">{u.regionCity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!codebookLoading &&
              codebook &&
              (codebookTab === 'dept' || codebookTab === 'ysu') && (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1.5">univ_code</th>
                      <th className="px-2 py-1.5">univ_name</th>
                      <th className="px-2 py-1.5">dept_code</th>
                      <th className="px-2 py-1.5">dept_name</th>
                      <th className="px-2 py-1.5">대계열</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codebookTab === 'ysu' && (
                      <tr className="border-t bg-amber-50/50">
                        <td className="px-2 py-1 font-mono">
                          {codebook.yeonsung.univCode}
                        </td>
                        <td className="px-2 py-1">
                          {codebook.yeonsung.univName}
                        </td>
                        <td className="px-2 py-1 font-mono">_ALL_</td>
                        <td className="px-2 py-1">대학 전체</td>
                        <td className="px-2 py-1">—</td>
                      </tr>
                    )}
                    {filteredDepts.map((d) => (
                      <tr
                        key={`${d.univCode}:${d.deptCode}`}
                        className="border-t"
                      >
                        <td className="px-2 py-1 font-mono">{d.univCode}</td>
                        <td className="px-2 py-1">{d.univName}</td>
                        <td className="px-2 py-1 font-mono">{d.deptCode}</td>
                        <td className="px-2 py-1">{d.deptName}</td>
                        <td className="px-2 py-1">{d.seriesLg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            {!codebookLoading &&
              metricCodebook &&
              (codebookTab === 'metric-alimi' ||
                codebookTab === 'metric-internal' ||
                codebookTab === 'metric-monitoring') && (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1.5">metric_id</th>
                      <th className="px-2 py-1.5">metric_name</th>
                      <th className="px-2 py-1.5">구분</th>
                      <th className="px-2 py-1.5">카테고리</th>
                      <th className="px-2 py-1.5">상위 지표</th>
                      <th className="px-2 py-1.5">단위</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMetrics.map((m) => (
                      <tr key={m.metricId} className="border-t">
                        <td className="px-2 py-1 font-mono">{m.metricId}</td>
                        <td className="px-2 py-1">{m.metricName}</td>
                        <td className="px-2 py-1">{m.sourceLabel}</td>
                        <td className="px-2 py-1">{m.categoryName}</td>
                        <td className="px-2 py-1">{m.parentMetricName ?? '—'}</td>
                        <td className="px-2 py-1">{m.metricUnit ?? '—'}</td>
                      </tr>
                    ))}
                    {filteredMetrics.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-2 py-4 text-center text-muted-foreground"
                        >
                          해당 지표가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
