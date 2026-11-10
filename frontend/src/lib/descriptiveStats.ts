/**
 * 조회 기간의 관측값에 대한 기초 기술통계.
 * 그 기간이 전체이므로 분산·표준편차·왜도·첨도는 값 개수 n으로 나눈다.
 * 첨도는 정규분포가 0인 초과첨도다.
 * 사분위수(IQR)는 QUARTILE.INC 기준 Q3 − Q1이다.
 */
export interface DescriptiveStats {
  mean: number | null;
  median: number | null;
  /** 두 번 이상 나타난 최빈값. 없으면 null. 동률이면 모두 포함. */
  modes: number[] | null;
  variance: number | null;
  stdev: number | null;
  range: number | null;
  iqr: number | null;
  skewness: number | null;
  kurtosis: number | null;
}

const EMPTY_STATS: DescriptiveStats = {
  mean: null,
  median: null,
  modes: null,
  variance: null,
  stdev: null,
  range: null,
  iqr: null,
  skewness: null,
  kurtosis: null,
};

/** 부동소수점 잡음을 같은 값으로 묶기 위한 최빈값 비교 단위 */
const MODE_SCALE = 1e6;

function modeKey(value: number): number {
  return Math.round(value * MODE_SCALE) / MODE_SCALE;
}

function repeatedModes(values: number[]): number[] | null {
  const buckets = new Map<number, number>();
  for (const value of values) {
    const key = modeKey(value);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  let max = 0;
  for (const count of buckets.values()) {
    if (count > max) max = count;
  }
  if (max < 2) return null;
  return [...buckets.entries()]
    .filter(([, count]) => count === max)
    .map(([key]) => key)
    .sort((a, b) => a - b);
}

/** Excel PERCENTILE.INC / QUARTILE.INC. sorted는 오름차순. */
function percentileInc(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 1) return sorted[0];
  const pos = (n - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const weight = pos - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

export function descriptiveStats(
  input: Array<number | null | undefined>,
): DescriptiveStats {
  const values = input.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );
  const n = values.length;
  if (n === 0) return EMPTY_STATS;

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const median =
    n % 2 === 1
      ? sorted[(n - 1) / 2]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

  let sumSq = 0;
  let sumCube = 0;
  let sumFourth = 0;
  for (const value of values) {
    const delta = value - mean;
    const sq = delta * delta;
    sumSq += sq;
    sumCube += sq * delta;
    sumFourth += sq * sq;
  }
  const variance = sumSq / n;
  const stdev = Math.sqrt(variance);
  const spread = stdev > 0 ? stdev : null;

  let skewness: number | null = null;
  if (n >= 2 && spread) {
    skewness = sumCube / n / (spread * spread * spread);
  }

  let kurtosis: number | null = null;
  if (n >= 2 && spread) {
    const raw = sumFourth / n / (spread * spread * spread * spread);
    kurtosis = raw - 3;
  }

  return {
    mean,
    median,
    modes: repeatedModes(values),
    variance,
    stdev,
    range: sorted[n - 1] - sorted[0],
    iqr: percentileInc(sorted, 0.75) - percentileInc(sorted, 0.25),
    skewness,
    kurtosis,
  };
}

export function formatDescriptiveNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 0.00005 ? 8 : 4;
  return value.toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

export function formatMode(modes: number[] | null): string {
  if (!modes || modes.length === 0) return '-';
  return modes.map((value) => formatDescriptiveNumber(value)).join(' / ');
}
