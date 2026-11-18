/** Source packaging only. Installed plugins use the frozen runtime and their prepare lifecycle. */
import { readFileSync, mkdirSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, '../../../../.cache/plugin-build/local-document-inspector');
const lock = JSON.parse(readFileSync(join(root, 'dependency-lock.json'), 'utf8'));
mkdirSync(source, { recursive: true });
writeFileSync(join(source, 'package.json'), JSON.stringify({ private: true, type: 'module', ...lock.packages[''] }));
cpSync(join(root, 'dependency-lock.json'), join(source, 'package-lock.json'));
const installed = existsSync(join(source, 'node_modules/puppeteer-core/package.json')) &&
  Object.entries(lock.packages[''].dependencies).every(([name, version]) =>
    JSON.parse(readFileSync(join(source, 'node_modules', name, 'package.json'), 'utf8')).version === version);
if (!installed) {
  const result = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', source], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Unable to prepare fixed document runtime dependencies');
}
const { build } = await import(pathToFileURL(join(source, 'node_modules/esbuild/lib/main.js')).href);
mkdirSync(join(root, 'dependencies'), { recursive: true });
await build({
  entryPoints: [join(root, 'runtime-source.mjs')], nodePaths: [join(source, 'node_modules')],
  outfile: join(root, 'dependencies/runtime.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', minify: true,
  banner: { js: "import { createRequire as documentCreateRequire } from 'node:module'; const require = documentCreateRequire(import.meta.url);" },
});
writeFileSync(join(root, 'dependencies/mermaid.min.js.gz'), gzipSync(readFileSync(join(source, 'node_modules/mermaid/dist/mermaid.min.js'))));
writeFileSync(join(root, 'dependencies/provenance.json'), JSON.stringify({
  packages: Object.fromEntries(Object.keys(lock.packages[''].dependencies).map(name => [name, {
    version: lock.packages['node_modules/' + name].version, integrity: lock.packages['node_modules/' + name].integrity,
  }])),
}, null, 2) + '\n');
