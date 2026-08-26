const fs = require('fs');
const t = fs.readFileSync('C:/temp_sp/original.txt', 'utf8');
const keys = ['<script', 'id="data"', 'id="cmpdata"', '</script>'];
for (const k of keys) {
  let i = -1;
  const arr = [];
  while ((i = t.indexOf(k, i + 1)) >= 0) arr.push(i);
  console.log(k, JSON.stringify(arr.slice(0, 30)));
}
