const fs = require('fs');
const t = fs.readFileSync('C:/temp_sp/original.txt', 'utf8');

function between(startIdx, endIdx) {
  const gt = t.indexOf('>', startIdx);
  return t.slice(gt + 1, endIdx).trim();
}

const planJson = between(318514, 358625);
const cmpJson = between(358643, 362043);
const appJs = between(362054, 401891);
const tail = t.slice(401891);

fs.writeFileSync('tmp-extract/plan.json', planJson, 'utf8');
fs.writeFileSync('tmp-extract/compare.json', cmpJson, 'utf8');
fs.writeFileSync('tmp-extract/app.js.txt', appJs, 'utf8');
fs.writeFileSync('tmp-extract/tail.txt', tail, 'utf8');

const plan = JSON.parse(planJson);
const cmp = JSON.parse(cmpJson);
console.log('plan keys:', Object.keys(plan));
console.log('cmp keys:', Object.keys(cmp));
console.log('appJs len', appJs.length, 'tail len', tail.length);
