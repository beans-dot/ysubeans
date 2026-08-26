const fs = require('fs');
const plan = JSON.parse(fs.readFileSync('tmp-extract/plan.json', 'utf8'));
const cmp = JSON.parse(fs.readFileSync('tmp-extract/compare.json', 'utf8'));

fs.writeFileSync(
  'backend/src/seed/strategic-plan-data.json',
  JSON.stringify(plan, null, 2) + '\n',
  'utf8',
);
fs.writeFileSync(
  'backend/src/seed/strategic-plan-compare.json',
  JSON.stringify(cmp, null, 2) + '\n',
  'utf8',
);
console.log('ok');
