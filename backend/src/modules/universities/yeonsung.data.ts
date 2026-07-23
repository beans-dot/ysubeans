// 수도권 광역 시/도 (대학 마스터 region_city 분류용)
const CAPITAL_AREA = ['서울', '인천', '경기'];

/** 공시 대계열명 정규화 (중점·별칭 통일). '기타'는 유효 계열이 아니므로 null */
export function normalizeSeriesLg(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/\s+/g, '');
  if (!s || s === '기타') return null;
  // 인문ㆍ사회 → 인문사회, 예·체능 → 예체능
  s = s.replace(/[ㆍ·･˙]/g, '');
  const aliases: Record<string, string> = {
    인문사회: '인문사회계열',
    인문사회계열: '인문사회계열',
    예체능: '예체능계열',
    예체능계열: '예체능계열',
    자연과학: '자연과학계열',
    자연과학계열: '자연과학계열',
    공학: '공학계열',
    공학계열: '공학계열',
    의학: '의학계열',
    의학계열: '의학계열',
    광역: '광역계열',
    광역계열: '광역계열',
  };
  return aliases[s] || (s.endsWith('계열') ? s : s);
}

/** 공시 자리표시 학과(기타/소속학과없음/기타모집단위) — 트리·활성 동기화에서 제외 */
export function isPlaceholderDepartment(deptName: string): boolean {
  const n = (deptName || '').replace(/\s+/g, '');
  if (!n) return false;
  if (n.includes('소속학과없음')) return true;
  if (n.startsWith('기타')) return true;
  return false;
}

// znNm(지역) -> 권역
export function classifyRegionType(regionCity: string | null | undefined): string {
  if (!regionCity) return '비수도권';
  return CAPITAL_AREA.some((c) => regionCity.includes(c)) ? '수도권' : '비수도권';
}

// schlKndNm(학교종류 원본) -> '전문대학' | '4년제' | null (임의 '기타' 금지)
export function classifySchoolType(
  rawKind: string | null | undefined,
): string | null {
  if (!rawKind) return null;
  if (rawKind.includes('전문')) return '전문대학';
  if (rawKind.includes('대학교') || rawKind.includes('대학')) return '4년제';
  return null;
}
