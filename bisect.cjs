const { execSync } = require('child_process');
const fs = require('fs');

const src = fs.readFileSync('src/App.jsx', 'utf8');
const lines = src.split('\n');
const total = lines.length;

function test(upTo) {
  const tmp = lines.slice(0, upTo).join('\n');
  fs.writeFileSync('_bisect_tmp.jsx', tmp);
  try {
    execSync('node_modules/.bin/esbuild _bisect_tmp.jsx --bundle=false --loader=jsx 2>&1', { stdio: 'pipe' });
    return true;
  } catch (e) {
    const out = e.stdout ? e.stdout.toString() : '';
    // Only count as failure if it's the regex error, not other JSX errors
    return !out.includes('Unterminated regular expression');
  }
}

console.log('Bisecting ' + total + ' lines...');
let lo = 1, hi = 1833;
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  process.stdout.write('  Testing up to line ' + mid + '... ');
  if (test(mid)) {
    console.log('OK');
    lo = mid + 1;
  } else {
    console.log('FAIL');
    hi = mid;
  }
}
console.log('\nFirst bad line: ' + lo);
console.log('Content:', lines[lo - 1]);
try { fs.unlinkSync('_bisect_tmp.jsx'); } catch(e) {}
