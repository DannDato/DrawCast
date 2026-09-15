import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['node_modules', 'logs']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
}

walk(root);
const missing = [];
const importRegex = /(?:import\s+(?:[^'\"]+?\s+from\s+)?|export\s+[^'\"]+?\s+from\s+)["'](\.[^"']+)["']/g;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(importRegex)) {
    const target = path.resolve(path.dirname(file), match[1]);
    const candidates = [target, `${target}.js`, path.join(target, 'index.js')];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) missing.push(`${path.relative(root, file)} -> ${match[1]}`);
  }
}

if (missing.length) {
  console.error('Imports locales inexistentes:');
  for (const row of missing) console.error(` - ${row}`);
  process.exit(1);
}

console.log(`Imports locales OK (${files.length} archivos JS revisados).`);
