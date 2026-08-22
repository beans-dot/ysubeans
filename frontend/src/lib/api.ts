import axios from 'axios';
import { clearAuthCookies, readTokenFromDocument } from '@/lib/auth';

// 브라우저에서는 Next rewrite(/api/backend/*)를 경유, 서버 컴포넌트에서는 직접 백엔드 호출
const isServer = typeof window === 'undefined';
const serverBase =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: isServer ? serverBase : '/api/backend',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (!isServer) {
    const token = readTokenFromDocument();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!isServer && error?.response?.status === 401) {
      const url = String(error?.config?.url || '');
      // 로그인/회원가입 실패는 세션 정리하지 않음
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        clearAuthCookies();
      }
    }
    return Promise.reject(error);
  },
);

export interface MetricNode {
  metricId: number;
  metricName: string;
  metricUnit: string | null;
  sourceType: 'ALIMI' | 'INTERNAL';
  displayOrder: number;
}

export interface CategoryTreeNode {
  categoryId: number;
  categoryName: string;
  displayOrder: number;
  sourceType?: 'ALIMI' | 'INTERNAL';
  metrics: MetricNode[];
}

export type TargetTreeLevel =
  | 'section'
  | 'root'
  | 'schoolType'
  | 'region'
  | 'regionCity'
  | 'univ'
  | 'series'
  | 'dept';

export interface TargetTreeNode {
  id: string;
  label: string;
  level: TargetTreeLevel | string;
  univCode?: string;
  deptCode?: string;
  isYeonsung?: boolean;
  selectable: boolean;
  memberDeptCodes?: string[];
  children?: TargetTreeNode[];
}

export interface PivotRow {
  targetKey: string;
  targetLabel: string;
  univCode: string;
  deptCode: string | null;
  isYeonsung: boolean;
  metricId: number;
  metricName: string;
  metricUnit: string | null;
  aggregationType: string;
  values: Record<number, number | null>;
}

export interface PivotResult {
  years: number[];
  rows: PivotRow[];
}

export interface UpdateLog {
  logId: number;
  updateDate: string;
  updateType: string;
  logText: string;
}

/** YSU = [연성대학교], EXTERNAL = [대학 외] */
export type AnnualEventCategory = 'YSU' | 'EXTERNAL';

export interface AnnualEvent {
  eventId: number;
  year: number;
  category: AnnualEventCategory;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export const ANNUAL_EVENT_CATEGORY_LABEL: Record<AnnualEventCategory, string> =
  {
    YSU: '연성대학교',
    EXTERNAL: '대학 외',
  };

export interface UniversityCodebook {
  generatedAt: string;
  referenceYear: number;
  yeonsung: {
    univCode: string;
    univName: string;
    departments: Array<{
      deptCode: string;
      deptName: string;
      seriesLg: string | null;
    }>;
  };
  universities: Array<{
    univCode: string;
    univName: string;
    schoolType: string | null;
    regionType: string | null;
    regionCity: string | null;
  }>;
  departments: Array<{
    univCode: string;
    univName: string;
    deptCode: string;
    deptName: string;
    seriesLg: string | null;
  }>;
}

export interface MetricCodebookEntry {
  metricId: number;
  metricName: string;
  sourceType: 'ALIMI' | 'INTERNAL';
  sourceLabel: '공시' | '자체';
  categoryName: string;
  metricUnit: string | null;
}

export interface MetricCodebook {
  generatedAt: string;
  metrics: MetricCodebookEntry[];
}

export type MemberStatus = 'pending' | 'approved' | 'rejected';

export interface MemberSummary {
  id: string;
  name: string;
  email: string;
  department: string;
  extension: string;
  role: 'admin' | 'user';
  status: MemberStatus;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

export interface LoginLogEntry {
  logId: number;
  userId: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  failReason: string | null;
  createdAt: string;
}

export interface RawCorrectionItem {
  rawId: number;
  year: number;
  univCode: string;
  deptCode: string;
  metricId: number;
  metricName: string;
  metricValue: string;
  isLocked: boolean;
}

export interface RawCorrectionListResult {
  total: number;
  items: RawCorrectionItem[];
}

export type RawCorrectionListParams = {
  year: number;
  univCode?: string;
  deptCode?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export async function fetchRawCorrectionYears() {
  const { data } = await api.get<number[]>('/raw-correction/years');
  return data;
}

export async function fetchRawCorrectionList(params: RawCorrectionListParams) {
  const { data } = await api.get<RawCorrectionListResult>('/raw-correction', {
    params: {
      year: params.year,
      univCode: params.univCode || undefined,
      deptCode: params.deptCode || undefined,
      q: params.q || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 100,
    },
  });
  return data;
}

export async function patchRawCorrectionValue(
  rawId: number,
  metricValue: string,
) {
  const { data } = await api.patch<RawCorrectionItem>(
    `/raw-correction/${rawId}`,
    { metricValue },
  );
  return data;
}

export async function deleteRawCorrection(rawIds: number[]) {
  const { data } = await api.delete<{ deleted: number }>('/raw-correction', {
    data: { rawIds },
  });
  return data;
}

export interface InternalDeptNode {
  deptPk: number;
  deptCode: string;
  deptName: string;
  displayOrder: number;
  rawCount: number;
}

export interface InternalSeriesNode {
  seriesId: number;
  seriesName: string;
  displayOrder: number;
  isUncategorized: boolean;
  departments: InternalDeptNode[];
}
