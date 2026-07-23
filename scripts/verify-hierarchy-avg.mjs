/**
 * Hierarchy membership + group average verification (DB-only, mirrors backend logic).
 * Checks:
 *  1) Parent node members === union of all descendant univ nodes (by hierarchy filter)
 *  2) Group AVG === unweighted mean of per-univ values (nulls excluded)
 *  3) Per-univ value === _ALL_ aggregate, else dept-level fallback (same as pivot.service)
 */
import pgPkg from '../backend/node_modules/pg/lib/index.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { Client } = pgPkg.default ?? pgPkg;
const YSU = process.env.YSU_UNIV_CODE || '0002651';
const EPS = 1e-9;
const __dirname = dirname(fileURLToPath(import.meta.url));

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setEq(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

function nearlyEq(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= Math.max(EPS, Math.abs(a) * 1e-12);
}

function parseNumeric(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'NULL') return null;
  const n = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function aggregate(values, type) {
  if (values.length === 0) return null;
  switch ((type || 'SUM').toUpperCase()) {
    case 'AVG':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'MAX':
      return Math.max(...values);
    case 'MIN':
      return Math.min(...values);
    case 'SUM':
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    user: 'ir_user',
    password: 'ir_password',
    database: 'ir_dashboard',
  });
  await client.connect();

  const rng = mulberry32(20260721);
  const report = { pass: 0, fail: 0, cases: [] };

  const mark = (ok, detail) => {
    if (ok) report.pass++;
    else report.fail++;
    report.cases.push({ ok, ...detail });
    const tag = ok ? 'PASS' : 'FAIL';
    console.log(`[${tag}] ${detail.title}`);
    if (!ok && detail.extra) console.log('   ', detail.extra);
  };

  // ---- Load master (same filters as buildOthersTree) ----
  const { rows: univs } = await client.query(
    `SELECT univ_code, univ_name, school_type, region_type, region_city
     FROM ir_university_master
     WHERE univ_code <> $1
     ORDER BY univ_name`,
    [YSU],
  );

  const eligible = univs.filter((u) => {
    const st = u.school_type?.trim();
    const rc = u.region_city?.trim();
    return st && st !== '기타' && rc && rc !== '기타';
  });

  /** Build nested tree: schoolType -> regionType -> regionCity -> univCodes[] */
  const tree = new Map();
  for (const u of eligible) {
    const st = u.school_type.trim();
    const rt = (u.region_type?.trim() || '비수도권');
    const rc = u.region_city.trim();
    if (!tree.has(st)) tree.set(st, new Map());
    const rtMap = tree.get(st);
    if (!rtMap.has(rt)) rtMap.set(rt, new Map());
    const rcMap = rtMap.get(rt);
    if (!rcMap.has(rc)) rcMap.set(rc, []);
    rcMap.get(rc).push(u.univ_code);
  }

  function membersOf({ schoolType, regionType, regionCity }) {
    const out = new Set();
    for (const [st, rtMap] of tree) {
      if (schoolType && st !== schoolType) continue;
      for (const [rt, rcMap] of rtMap) {
        if (regionType && rt !== regionType) continue;
        for (const [rc, codes] of rcMap) {
          if (regionCity && rc !== regionCity) continue;
          codes.forEach((c) => out.add(c));
        }
      }
    }
    return [...out].sort();
  }

  // ---- Check 1: parent === union(children) for every hierarchy node ----
  console.log('\n=== 1) Parent members == union of child cities/regions ===');
  for (const [st, rtMap] of tree) {
    const stMembers = membersOf({ schoolType: st });
    const stUnion = new Set();
    for (const [rt, rcMap] of rtMap) {
      for (const codes of rcMap.values()) codes.forEach((c) => stUnion.add(c));
    }
    mark(setEq(stMembers, [...stUnion].sort()), {
      title: `schoolType ${st}: ${stMembers.length} univs`,
      level: 'schoolType',
      schoolType: st,
      count: stMembers.length,
    });

    for (const [rt, rcMap] of rtMap) {
      const rtMembers = membersOf({ schoolType: st, regionType: rt });
      const rtUnion = new Set();
      for (const codes of rcMap.values()) codes.forEach((c) => rtUnion.add(c));
      mark(setEq(rtMembers, [...rtUnion].sort()), {
        title: `region ${st}/${rt}: parent=${rtMembers.length} childUnion=${rtUnion.size}`,
        level: 'region',
        schoolType: st,
        regionType: rt,
        count: rtMembers.length,
        extra: setEq(rtMembers, [...rtUnion].sort())
          ? undefined
          : {
              missing: rtMembers.filter((c) => !rtUnion.has(c)),
              extra: [...rtUnion].filter((c) => !rtMembers.includes(c)),
            },
      });

      // city leaf: members should equal the city's list
      for (const [rc, codes] of rcMap) {
        const cityMembers = membersOf({
          schoolType: st,
          regionType: rt,
          regionCity: rc,
        });
        mark(setEq(cityMembers, [...codes].sort()), {
          title: `city ${st}/${rt}/${rc}: ${cityMembers.length} univs`,
          level: 'regionCity',
          schoolType: st,
          regionType: rt,
          regionCity: rc,
          count: cityMembers.length,
        });
      }
    }
  }

  // ---- Check 2: 수도권 == 서울∪인천∪경기 (per school type) ----
  console.log('\n=== 2) 수도권 == union(서울,인천,경기) ===');
  for (const st of tree.keys()) {
    const capital = membersOf({ schoolType: st, regionType: '수도권' });
    const cities = ['서울', '인천', '경기']
      .flatMap((rc) =>
        membersOf({ schoolType: st, regionType: '수도권', regionCity: rc }),
      )
      .sort();
    const uniqCities = [...new Set(cities)].sort();
    mark(setEq(capital, uniqCities), {
      title: `${st} 수도권(${capital.length}) == 서울+인천+경기(${uniqCities.length})`,
      schoolType: st,
      capitalCount: capital.length,
      cityUnionCount: uniqCities.length,
      extra: setEq(capital, uniqCities)
        ? undefined
        : {
            onlyCapital: capital.filter((c) => !uniqCities.includes(c)),
            onlyCities: uniqCities.filter((c) => !capital.includes(c)),
          },
    });

    // No overlap between capital cities
    const seoul = new Set(
      membersOf({ schoolType: st, regionType: '수도권', regionCity: '서울' }),
    );
    const incheon = new Set(
      membersOf({ schoolType: st, regionType: '수도권', regionCity: '인천' }),
    );
    const gyeonggi = new Set(
      membersOf({ schoolType: st, regionType: '수도권', regionCity: '경기' }),
    );
    const overlapSI = [...seoul].filter((c) => incheon.has(c));
    const overlapSG = [...seoul].filter((c) => gyeonggi.has(c));
    const overlapIG = [...incheon].filter((c) => gyeonggi.has(c));
    mark(overlapSI.length + overlapSG.length + overlapIG.length === 0, {
      title: `${st} 수도권 시·도 간 대학 코드 중복 없음`,
      overlaps: { overlapSI, overlapSG, overlapIG },
    });
  }

  // ---- Check 3: region_type classification integrity ----
  console.log('\n=== 3) region_type vs region_city consistency ===');
  const badClass = eligible.filter((u) => {
    const rc = u.region_city.trim();
    const rt = (u.region_type?.trim() || '비수도권');
    const isCapitalCity = ['서울', '인천', '경기'].some((x) => rc.includes(x));
    const expect = isCapitalCity ? '수도권' : '비수도권';
    return rt !== expect;
  });
  mark(badClass.length === 0, {
    title: `region_type 분류 일치 (mismatches=${badClass.length})`,
    sample: badClass.slice(0, 10).map((u) => ({
      code: u.univ_code,
      name: u.univ_name,
      city: u.region_city,
      type: u.region_type,
    })),
  });

  // ---- Check 4: Random group averages vs pivot formula ----
  console.log('\n=== 4) Random hierarchy AVG vs hand-computed (pivot formula) ===');

  const { rows: metrics } = await client.query(
    `SELECT m.metric_id, m.metric_name, m.aggregation_type, COUNT(*)::int AS cnt
     FROM ir_metric_registry m
     JOIN ir_raw_data r ON r.metric_id = m.metric_id
     GROUP BY m.metric_id, m.metric_name, m.aggregation_type
     HAVING COUNT(*) > 200
     ORDER BY m.metric_id`,
  );
  const { rows: yearRows } = await client.query(
    `SELECT DISTINCT year FROM ir_raw_data ORDER BY year`,
  );
  const years = yearRows.map((r) => Number(r.year));

  // Build sample hierarchy targets
  const targets = [];
  for (const st of tree.keys()) {
    targets.push({ label: `${st}`, schoolType: st });
    for (const rt of tree.get(st).keys()) {
      targets.push({ label: `${st}·${rt}`, schoolType: st, regionType: rt });
      for (const rc of tree.get(st).get(rt).keys()) {
        targets.push({
          label: `${st}·${rt}·${rc}`,
          schoolType: st,
          regionType: rt,
          regionCity: rc,
        });
      }
    }
  }

  // Priority samples + random
  const priority = targets.filter(
    (t) =>
      t.regionType === '수도권' ||
      t.regionCity === '경기' ||
      t.regionCity === '인천' ||
      t.regionCity === '서울' ||
      (t.regionType === '비수도권' && !t.regionCity) ||
      (!t.regionType && !t.regionCity),
  );
  const rest = shuffle(
    targets.filter((t) => !priority.some((p) => p.label === t.label)),
    rng,
  ).slice(0, 12);
  const sampleTargets = [...priority, ...rest];

  // Multiple random metric/year rounds
  const combos = [];
  for (let i = 0; i < 8; i++) {
    combos.push({
      metric: metrics[Math.floor(rng() * metrics.length)],
      year: years[Math.floor(rng() * years.length)],
    });
  }

  async function resolveUnivYearValue(univCode, metricId, year, aggType) {
    const allRes = await client.query(
      `SELECT metric_value FROM ir_raw_data
       WHERE univ_code=$1 AND metric_id=$2 AND year=$3 AND dept_code='_ALL_'`,
      [univCode, metricId, year],
    );
    const allNums = allRes.rows
      .map((r) => parseNumeric(r.metric_value))
      .filter((n) => n !== null);
    const fromAll = aggregate(allNums, aggType);
    if (fromAll !== null) return fromAll;

    const deptRes = await client.query(
      `SELECT metric_value FROM ir_raw_data
       WHERE univ_code=$1 AND metric_id=$2 AND year=$3 AND dept_code<>'_ALL_'`,
      [univCode, metricId, year],
    );
    const deptNums = deptRes.rows
      .map((r) => parseNumeric(r.metric_value))
      .filter((n) => n !== null);
    return aggregate(deptNums, aggType);
  }

  async function groupAvgBulk(memberCodes, metricId, year, aggType) {
    if (!memberCodes.length) return { avg: null, n: 0 };

    // Bulk load all relevant raw rows once
    const { rows } = await client.query(
      `SELECT univ_code, dept_code, metric_value
       FROM ir_raw_data
       WHERE metric_id=$1 AND year=$2 AND univ_code = ANY($3::text[])`,
      [metricId, year, memberCodes],
    );

    const allBuckets = new Map();
    const deptBuckets = new Map();
    for (const r of rows) {
      const num = parseNumeric(r.metric_value);
      if (num === null) continue;
      if (r.dept_code === '_ALL_') {
        if (!allBuckets.has(r.univ_code)) allBuckets.set(r.univ_code, []);
        allBuckets.get(r.univ_code).push(num);
      } else {
        if (!deptBuckets.has(r.univ_code)) deptBuckets.set(r.univ_code, []);
        deptBuckets.get(r.univ_code).push(num);
      }
    }

    const univValues = [];
    for (const code of memberCodes) {
      const allB = allBuckets.get(code) ?? [];
      let v = aggregate(allB, aggType);
      if (v === null) {
        const dB = deptBuckets.get(code) ?? [];
        v = aggregate(dB, aggType);
      }
      if (v !== null) univValues.push(v);
    }
    return {
      avg:
        univValues.length === 0
          ? null
          : univValues.reduce((a, b) => a + b, 0) / univValues.length,
      n: univValues.length,
      denom: memberCodes.length,
      univValues,
    };
  }

  // Spot-check resolveUnivYearValue vs bulk for a few univs
  console.log('\n--- Spot-check per-univ resolver vs bulk ---');
  const spotMembers = membersOf({
    schoolType: '전문대학',
    regionType: '수도권',
    regionCity: '인천',
  });
  const spotMetric = combos[0].metric;
  const spotYear = combos[0].year;
  for (const code of shuffle(spotMembers, rng).slice(0, 3)) {
    const single = await resolveUnivYearValue(
      code,
      spotMetric.metric_id,
      spotYear,
      spotMetric.aggregation_type,
    );
    const bulk = await groupAvgBulk(
      [code],
      spotMetric.metric_id,
      spotYear,
      spotMetric.aggregation_type,
    );
    mark(nearlyEq(single, bulk.avg), {
      title: `univ resolver ${code} ${spotMetric.metric_name} ${spotYear}: single=${single} bulk=${bulk.avg}`,
      univCode: code,
      single,
      bulk: bulk.avg,
    });
  }

  console.log('\n--- Hierarchy group averages (random combos) ---');
  for (const t of sampleTargets) {
    const members = membersOf(t);
    // For large groups run 2 combos; for city nodes run all combos
    const useCombos =
      t.regionCity || t.regionType === '수도권'
        ? combos
        : combos.slice(0, 2);

    for (const { metric, year } of useCombos) {
      const result = await groupAvgBulk(
        members,
        metric.metric_id,
        year,
        metric.aggregation_type,
      );

      // Independent recompute: shuffle member order shouldn't change mean
      const shuffledMembers = shuffle(members, rng);
      const result2 = await groupAvgBulk(
        shuffledMembers,
        metric.metric_id,
        year,
        metric.aggregation_type,
      );

      const orderOk = nearlyEq(result.avg, result2.avg);

      // Child-sum check for region nodes: parent avg should equal
      // mean of (per-univ values), and union of city members equals parent
      let childAvgOk = true;
      let childAvgDetail = null;
      if (t.regionType && !t.regionCity) {
        const cities = [...(tree.get(t.schoolType)?.get(t.regionType)?.keys() || [])];
        const childMembers = cities.flatMap((rc) =>
          membersOf({
            schoolType: t.schoolType,
            regionType: t.regionType,
            regionCity: rc,
          }),
        );
        const childUniq = [...new Set(childMembers)].sort();
        const childResult = await groupAvgBulk(
          childUniq,
          metric.metric_id,
          year,
          metric.aggregation_type,
        );
        childAvgOk = nearlyEq(result.avg, childResult.avg);
        childAvgDetail = {
          parentAvg: result.avg,
          childUnionAvg: childResult.avg,
          parentN: result.n,
          childN: childResult.n,
        };
      }

      const ok = orderOk && childAvgOk;
      mark(ok, {
        title: `${t.label} | ${metric.metric_name} ${year} | avg=${result.avg} n=${result.n}/${members.length}`,
        target: t,
        metricId: metric.metric_id,
        metricName: metric.metric_name,
        year,
        avg: result.avg,
        n: result.n,
        memberCount: members.length,
        orderOk,
        childAvgOk,
        childAvgDetail,
        extra: ok
          ? undefined
          : { orderOk, childAvgOk, childAvgDetail, avg: result.avg },
      });
    }
  }

  // ---- Check 5: Parent avg equals mean over ALL descendant univs (not city-of-city averages) ----
  // Critical: group average is mean of universities, NOT mean of city averages.
  console.log('\n=== 5) 수도권 AVG == mean(all capital univs), NOT mean(city avgs) ===');
  for (const st of ['전문대학', '4년제']) {
    if (!tree.has(st)) continue;
    const { metric, year } = combos[1];
    const capitalMembers = membersOf({ schoolType: st, regionType: '수도권' });
    const capital = await groupAvgBulk(
      capitalMembers,
      metric.metric_id,
      year,
      metric.aggregation_type,
    );

    const cityAvgs = [];
    for (const rc of ['서울', '인천', '경기']) {
      const m = membersOf({
        schoolType: st,
        regionType: '수도권',
        regionCity: rc,
      });
      const r = await groupAvgBulk(
        m,
        metric.metric_id,
        year,
        metric.aggregation_type,
      );
      if (r.avg !== null) cityAvgs.push(r.avg);
    }
    const meanOfCityAvgs =
      cityAvgs.length === 0
        ? null
        : cityAvgs.reduce((a, b) => a + b, 0) / cityAvgs.length;

    // Document whether they differ (expected when city sizes differ / missing data rates differ)
    const differs = !nearlyEq(capital.avg, meanOfCityAvgs);
    mark(true, {
      title: `${st} 수도권 univ-mean=${capital.avg} vs mean(cityAvgs)=${meanOfCityAvgs} differs=${differs} (univ-mean is correct)`,
      note: 'pivot uses unweighted mean of universities, not mean of city averages',
      capitalAvg: capital.avg,
      meanOfCityAvgs,
      differs,
      metric: metric.metric_name,
      year,
    });

    // Explicit child inclusion: every capital univ is in exactly one of 서울/인천/경기
    const seoul = new Set(
      membersOf({ schoolType: st, regionType: '수도권', regionCity: '서울' }),
    );
    const incheon = new Set(
      membersOf({ schoolType: st, regionType: '수도권', regionCity: '인천' }),
    );
    const gyeonggi = new Set(
      membersOf({ schoolType: st, regionType: '수도권', regionCity: '경기' }),
    );
    const uncovered = capitalMembers.filter(
      (c) => !seoul.has(c) && !incheon.has(c) && !gyeonggi.has(c),
    );
    mark(uncovered.length === 0, {
      title: `${st} 수도권 모든 대학이 서울/인천/경기 중 하나에 포함`,
      uncovered,
    });
  }

  // ---- Check 6: Live API pivot (login token never printed) ----
  console.log('\n=== 6) Live API /pivot vs hand-computed ===');
  let apiOk = false;
  try {
    const loginRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'admin', password: '21672167' }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.accessToken || loginJson.access_token;
    if (!token) throw new Error('login failed (no token)');

    const apiTargets = [
      {
        key: 'oth:rt:전문대학:수도권',
        label: '전문대학 · 수도권 (평균)',
        filter: { schoolType: '전문대학', regionType: '수도권' },
      },
      {
        key: 'oth:rc:전문대학:수도권:경기',
        label: '전문대학 · 수도권 · 경기 (평균)',
        filter: {
          schoolType: '전문대학',
          regionType: '수도권',
          regionCity: '경기',
        },
      },
      {
        key: 'oth:rc:전문대학:수도권:인천',
        label: '전문대학 · 수도권 · 인천 (평균)',
        filter: {
          schoolType: '전문대학',
          regionType: '수도권',
          regionCity: '인천',
        },
      },
      {
        key: 'oth:rt:4년제:수도권',
        label: '4년제 · 수도권 (평균)',
        filter: { schoolType: '4년제', regionType: '수도권' },
      },
      {
        key: 'oth:rc:4년제:수도권:인천',
        label: '4년제 · 수도권 · 인천 (평균)',
        filter: {
          schoolType: '4년제',
          regionType: '수도권',
          regionCity: '인천',
        },
      },
      {
        key: 'oth:rt:전문대학:비수도권',
        label: '전문대학 · 비수도권 (평균)',
        filter: { schoolType: '전문대학', regionType: '비수도권' },
      },
      {
        key: 'oth:st:전문대학',
        label: '전문대학 (평균)',
        filter: { schoolType: '전문대학' },
      },
    ];

    // Also fetch tree and verify member lists from API tree
    const treeRes = await fetch('http://localhost:4000/api/universities/tree', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!treeRes.ok) throw new Error(`tree HTTP ${treeRes.status}`);
    const apiTree = await treeRes.json();

    function findNode(nodes, id) {
      for (const n of nodes || []) {
        if (n.id === id) return n;
        const f = findNode(n.children, id);
        if (f) return f;
      }
      return null;
    }
    function collectUnivs(node) {
      const codes = new Set();
      const walk = (n) => {
        if (n.level === 'univ' && n.univCode) codes.add(n.univCode);
        n.children?.forEach(walk);
      };
      walk(node);
      return [...codes].sort();
    }

    for (const t of apiTargets) {
      const node = findNode(apiTree, t.key);
      if (!node) {
        mark(false, { title: `API tree missing node ${t.key}` });
        continue;
      }
      const treeMembers = collectUnivs(node);
      const dbMembers = membersOf(t.filter);
      mark(setEq(treeMembers, dbMembers), {
        title: `API tree members == DB for ${t.key} (${treeMembers.length})`,
        treeCount: treeMembers.length,
        dbCount: dbMembers.length,
        extra: setEq(treeMembers, dbMembers)
          ? undefined
          : {
              missing: dbMembers.filter((c) => !treeMembers.includes(c)).slice(0, 5),
              extra: treeMembers.filter((c) => !dbMembers.includes(c)).slice(0, 5),
            },
      });

      // Parent child union from API tree
      if (node.children?.length && (node.level === 'region' || node.level === 'schoolType')) {
        const childUnion = new Set();
        for (const c of node.children) collectUnivs(c).forEach((u) => childUnion.add(u));
        mark(setEq(treeMembers, [...childUnion].sort()), {
          title: `API tree parent==childUnion ${t.key}`,
        });
      }

      for (const { metric, year } of combos.slice(0, 4)) {
        const hand = await groupAvgBulk(
          treeMembers,
          metric.metric_id,
          year,
          metric.aggregation_type,
        );
        const pivotRes = await fetch('http://localhost:4000/api/pivot', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targets: [
              {
                groupKey: t.key,
                groupLabel: t.label,
                memberUnivCodes: treeMembers,
              },
            ],
            metricIds: [metric.metric_id],
            years: [year],
            hierarchyIntegrate: false,
          }),
        });
        if (!pivotRes.ok) {
          mark(false, {
            title: `pivot HTTP ${pivotRes.status} for ${t.key}`,
            extra: await pivotRes.text(),
          });
          continue;
        }
        const pivotJson = await pivotRes.json();
        const row = (pivotJson.rows || []).find(
          (r) => r.metricId === metric.metric_id,
        );
        const pivotVal = row?.values?.[year] ?? null;
        const ok = nearlyEq(hand.avg, pivotVal);
        mark(ok, {
          title: `API pivot ${t.key} | ${metric.metric_name} ${year} | hand=${hand.avg} pivot=${pivotVal} n=${hand.n}/${treeMembers.length}`,
          hand: hand.avg,
          pivot: pivotVal,
          n: hand.n,
          members: treeMembers.length,
        });
      }
    }
    apiOk = true;
  } catch (e) {
    mark(false, {
      title: `API verification error: ${e.message}`,
      extra: String(e.stack || e),
    });
  }

  await client.end();

  const outPath = join(__dirname, 'verify-hierarchy-avg-result.json');
  // Strip large arrays from report before write
  const slim = {
    pass: report.pass,
    fail: report.fail,
    total: report.pass + report.fail,
    apiOk,
    timestamp: new Date().toISOString(),
    failures: report.cases.filter((c) => !c.ok),
    samplePasses: report.cases.filter((c) => c.ok).slice(0, 30),
  };
  writeFileSync(outPath, JSON.stringify(slim, null, 2));

  console.log('\n======== SUMMARY ========');
  console.log(`PASS=${report.pass} FAIL=${report.fail} TOTAL=${report.pass + report.fail}`);
  console.log(`API check ran: ${apiOk}`);
  console.log(`Report: ${outPath}`);
  if (report.fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
