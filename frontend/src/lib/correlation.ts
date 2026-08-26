/** 피어슨 적률상관계수. 관측치가 2개 미만이거나 분산이 0이면 null. */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  const r = num / den;
  if (!Number.isFinite(r)) return null;
  return Math.max(-1, Math.min(1, r));
}

export function pairedSeriesValues(
  data: Array<Record<string, number | string | null>>,
  keyA: string,
  keyB: string,
): { xs: number[]; ys: number[]; n: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of data) {
    const a = row[keyA];
    const b = row[keyB];
    if (
      typeof a === 'number' &&
      Number.isFinite(a) &&
      typeof b === 'number' &&
      Number.isFinite(b)
    ) {
      xs.push(a);
      ys.push(b);
    }
  }
  return { xs, ys, n: xs.length };
}

/** Lanczos approximation of ln Γ(z) for z > 0 */
function logGamma(z: number): number {
  const p = [
    676.5203681218851, -1259.1392167224128, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const y = z - 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < p.length; i++) x += p[i] / (y + i + 1);
  const t = y + p.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const maxIter = 200;
  const eps = 3e-12;
  const fpmin = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b) */
function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const logBt =
    logGamma(a + b) -
    logGamma(a) -
    logGamma(b) +
    a * Math.log(x) +
    b * Math.log(1 - x);
  const bt = Math.exp(logBt);
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaContinuedFraction(x, a, b)) / a;
  }
  return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

function studentTTwoTailedP(absT: number, df: number): number {
  if (!Number.isFinite(absT) || absT === Number.POSITIVE_INFINITY) return 0;
  const x = df / (df + absT * absT);
  const p = regularizedIncompleteBeta(x, df / 2, 0.5);
  if (!Number.isFinite(p)) return 1;
  return Math.max(0, Math.min(1, p));
}

/**
 * H0: ρ = 0 에 대한 피어슨 r의 양측 유의확률.
 * 자유도 n-2 이므로 관측치 3개 미만이면 null.
 */
export function pearsonPValue(r: number, n: number): number | null {
  if (n < 3 || !Number.isFinite(r)) return null;
  if (Math.abs(r) >= 1) return 0;
  const df = n - 2;
  const t = Math.abs(r) * Math.sqrt(df / (1 - r * r));
  if (!Number.isFinite(t)) return 0;
  return studentTTwoTailedP(t, df);
}

export function formatPValue(p: number): string {
  if (p < 0.001) return 'p < 0.001';
  return `p = ${p.toFixed(3)}`;
}

export function describePValue(p: number): string {
  if (p < 0.05) return '통계적 유의성이 인정됩니다.';
  if (p < 0.1) return '유의하나 불확실한 수준입니다.';
  return '통계적 유의성이 없습니다.';
}

export function describeCorrelation(r: number): string {
  const abs = Math.abs(r);
  const shown = r.toFixed(2);
  const direction =
    r > 0 ? '양의 상관관계' : r < 0 ? '음의 상관관계' : null;

  let strength: string;
  if (abs >= 0.9) strength = '매우 강한 상관';
  else if (abs >= 0.7) strength = '강력한 상관';
  else if (abs >= 0.5) strength = '중간 상관';
  else if (abs > 0.3) strength = '약한 상관';
  else strength = '상관관계가 없거나 미약함';

  if (abs <= 0.3) {
    if (direction) {
      return `상관계수 ${shown} — ${direction}이며, 상관관계가 없거나 미약합니다.`;
    }
    return `상관계수 ${shown} — 상관관계가 없거나 미약합니다.`;
  }
  return `상관계수 ${shown} — ${direction}이며, ${strength}입니다.`;
}
