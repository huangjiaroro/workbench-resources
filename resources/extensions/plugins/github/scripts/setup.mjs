import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { packageRoot, targetRoot, platform, arch, runtimePaths } = JSON.parse(input);
const { version, platforms } = JSON.parse(
  readFileSync(join(packageRoot, 'dependencies.lock.json'), 'utf8')
);
const dependency = platforms[`${platform}-${arch}`];
if (!dependency) throw new Error(`GitHub 插件不支持 ${platform}/${arch}`);

const release = `gh_${version}_${dependency.asset}`;
const response = await fetch(
  `https://github.com/cli/cli/releases/download/v${version}/${release}.zip`,
  { signal: AbortSignal.timeout(180_000) }
);
if (!response.ok) throw new Error(`GitHub CLI 下载失败 (HTTP ${response.status})`);
const chunks = [];
let size = 0;
for await (const chunk of response.body) {
  size += chunk.length;
  if (size > dependency.bytes) throw new Error('GitHub CLI 归档大小不符');
  chunks.push(chunk);
}
const archive = Buffer.concat(chunks, size);
if (size !== dependency.bytes || createHash('sha256').update(archive).digest('hex') !== dependency.sha256) {
  throw new Error('GitHub CLI 归档完整性校验失败');
}

const windows = platform === 'win32';
const bin = join(targetRoot, 'bin');
const executable = join(bin, windows ? 'gh.exe' : 'gh');
const archivePath = join(targetRoot, 'gh.zip');
const archiveRoot = windows ? '' : `${release}/`;
mkdirSync(bin, { recursive: true });
writeFileSync(archivePath, archive, { flag: 'wx' });
try {
  const extract = (entry) => execFileSync('tar', ['-xOf', archivePath, archiveRoot + entry], {
    maxBuffer: 64 * 1024 * 1024,
    timeout: 20_000,
    windowsHide: true,
  });
  writeFileSync(executable, extract(windows ? 'bin/gh.exe' : 'bin/gh'), { mode: 0o755 });
  writeFileSync(join(targetRoot, 'LICENSE-gh'), extract('LICENSE'));
} finally {
  rmSync(archivePath, { force: true });
}
const reported = execFileSync(executable, ['--version'], { encoding: 'utf8', timeout: 10_000 });
if (reported.split(/\s+/)[2] !== version) throw new Error('GitHub CLI 版本不符');
const script = join(targetRoot, 'github.mjs');
copyFileSync(join(packageRoot, 'scripts', 'github.mjs'), script);
execFileSync(runtimePaths.node, [script, '--help'], { timeout: 10_000 });
console.log(`GitHub CLI ${version} 已准备 (${platform}/${arch})`);
