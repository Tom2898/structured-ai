const fs = require('fs');
const src = fs.readFileSync('src/App.jsx', 'utf8');
const lines = src.split('\n');
lines.forEach((l, i) => {
  if (i >= 1833) return;
  // Strip string contents to avoid false positives
  const t = l
    .replace(/`[^`]*`/g, '``')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""');
  // Find slashes that aren't comments, closing tags, or CSS
  if (/[^a-zA-Z<>"'`]\/[^/*>"'`]/.test(t)) {
    console.log(i + 1, '|', l.trim().slice(0, 150));
  }
});
