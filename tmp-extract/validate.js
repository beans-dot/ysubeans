const fs = require('fs');
const plan = JSON.parse(fs.readFileSync('tmp-extract/plan.json', 'utf8'));
const cmp = JSON.parse(fs.readFileSync('tmp-extract/compare.json', 'utf8'));

const shortMap = new Map();
const dupShort = [];
for (const t of plan.tasks) {
  const s = t.code.split('-')[0];
  if (shortMap.has(s)) dupShort.push(s);
  shortMap.set(s, t.code);
}
console.log('task count', plan.tasks.length, 'dup short prefixes', dupShort);

const unresolved = plan.kpis.filter((k) => !shortMap.has(k.task_code)).map((k) => k.code + '->' + k.task_code);
console.log('kpis with unresolvable task_code:', unresolved);

const kpiCodes = new Set(plan.kpis.map((k) => k.code));
const missingKpi = [];
for (const t of plan.tasks) for (const c of t.kpi_codes || []) if (!kpiCodes.has(c)) missingKpi.push(t.code + '->' + c);
console.log('task.kpi_codes not in kpis:', missingKpi);

const referenced = new Set(plan.tasks.flatMap((t) => t.kpi_codes || []));
console.log('kpis not referenced by any task:', plan.kpis.filter((k) => !referenced.has(k.code)).map((k) => k.code));

const subPairs = new Set();
const dupSub = [];
const globalSub = new Set();
const dupSubGlobal = [];
for (const t of plan.tasks) {
  for (const s of t.subtasks || []) {
    const key = t.code + '||' + s.code;
    if (subPairs.has(key)) dupSub.push(key);
    subPairs.add(key);
    if (globalSub.has(s.code)) dupSubGlobal.push(s.code);
    globalSub.add(s.code);
  }
}
console.log('subtask total', subPairs.size, 'dup (task,code)', dupSub, 'dup global code', dupSubGlobal);

console.log('related_depts null tasks:', plan.tasks.filter((t) => t['연관부서'] == null).map((t) => t.code));
console.log('primary depts:', [...new Set(plan.tasks.map((t) => t['책임부서']))].length);

const years = new Set();
plan.kpis.forEach((k) => Object.keys(k.targets || {}).forEach((y) => years.add(y)));
console.log('target years:', [...years].sort());

console.log('--- compare ---');
console.log('years', cmp.years, 'kasfo_collected', cmp.kasfo_collected);
cmp.indicators.forEach((i) => {
  console.log(i.id, '|', i.name, '| keys:', Object.keys(i).join(','), '| yearKeys:', Object.keys(i.years).join(','));
  if (i.alt) console.log('   alt keys:', Object.keys(i.alt).join(','), JSON.stringify(i.alt).slice(0, 300));
  const y = i.years[String(cmp.years[0])];
  console.log('   sample payload keys:', Object.keys(y).join(','), JSON.stringify(y).slice(0, 240));
});
