import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const documents = ['README.md'];
function collect(directory) {
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory() && !['dependencies','node_modules','.cache'].includes(entry.name)) collect(path);
    else if (entry.isFile() && entry.name.endsWith('.md')) documents.push(path);
  }
}
collect('docs');
collect('resources');

const unfenced = (text) => text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '');
const anchors = new Map();
function documentAnchors(path) {
  if (anchors.has(path)) return anchors.get(path);
  const ids = new Set(),
    counts = new Map();
  for (const match of unfenced(readFileSync(path, 'utf8')).matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = match[1]
      .replace(/<[^>]*>/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '')
      .replace(/\s/g, '-');
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    ids.add(base + (count ? '-' + count : ''));
  }
  for (const match of readFileSync(path, 'utf8').matchAll(/\bid=["']([^"']+)["']/g)) ids.add(match[1]);
  anchors.set(path, ids);
  return ids;
}
const issues = [];
for (const document of documents) {
  const path = resolve(root, document),
    source = unfenced(readFileSync(path, 'utf8'));
  for (const match of source.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\)/g)) {
    const link = match[1] ?? match[2];
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(link)) continue;
    let target, anchor;
    try {
      const [relative, fragment] = link.split('#');
      target = resolve(dirname(path), decodeURIComponent(relative || ''));
      if (!relative) target = path;
      anchor = fragment ? decodeURIComponent(fragment) : '';
    } catch {
      issues.push(`${document}: invalid link ${link}`);
      continue;
    }
    if (!existsSync(target)) {
      issues.push(`${document}: missing ${link}`);
      continue;
    }
    if (
      anchor &&
      extname(target) === '.md' &&
      statSync(target).isFile() &&
      !documentAnchors(target).has(anchor)
    )
      issues.push(`${document}: missing heading ${link}`);
  }
}
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else console.log(`Documentation links and headings: ${documents.length} files checked.`);
