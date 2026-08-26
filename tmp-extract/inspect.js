const fs = require('fs');
const plan = JSON.parse(fs.readFileSync('tmp-extract/plan.json', 'utf8'));
const cmp = JSON.parse(fs.readFileSync('tmp-extract/compare.json', 'utf8'));

console.log('=== plan.plan ===');
console.log(JSON.stringify(plan.plan, null, 2));
console.log('=== plan.vision ===');
console.log(JSON.stringify(plan.vision, null, 2));
console.log('=== goals ===');
console.log(JSON.stringify(plan.goals, null, 2));
console.log('=== strategies (first 3 + count) ===', plan.strategies.length);
console.log(JSON.stringify(plan.strategies.slice(0, 3), null, 2));
console.log('=== tasks count ===', plan.tasks.length);
console.log(JSON.stringify(plan.tasks.slice(0, 3), null, 2));
console.log('=== kpis count ===', plan.kpis.length);
console.log(JSON.stringify(plan.kpis.slice(0, 3), null, 2));
console.log('=== cmp ===');
console.log(JSON.stringify(cmp, null, 2).slice(0, 4000));
