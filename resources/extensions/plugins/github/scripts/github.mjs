import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const help = `wb-github --connection FILE <command> [options]
  whoami
  repo         --repo OWNER/REPO
  pr-list      --repo OWNER/REPO [--head BRANCH] [--base BRANCH]
  pr-view      --repo OWNER/REPO --number PR
  pr-comments  --repo OWNER/REPO --number PR
  pr-checks    --repo OWNER/REPO --number PR
  run-failures --repo OWNER/REPO --number RUN
  push         --repo OWNER/REPO --branch BRANCH
  remote-head  --repo OWNER/REPO --branch BRANCH
  pr-create    --repo OWNER/REPO --head BRANCH --base BRANCH --title TITLE --body-file FILE [--draft]`;

const gh = fileURLToPath(new URL(process.platform === 'win32' ? './bin/gh.exe' : './bin/gh', import.meta.url));
const options = Object.fromEntries(
  ['connection', 'repo', 'number', 'head', 'base', 'branch', 'title', 'body-file'].map(
    (name) => [name, { type: 'string' }]
  )
);
options.draft = { type: 'boolean' };

async function run(program, args, env) {
  const child = spawn(program, args, { env, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 130 : 143)));
    });
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
}

function resolveCommand(command, args) {
  const required = (key) => {
    const value = args[key];
    if (!value?.trim()) throw new Error(`缺少 --${key}`);
    return value;
  };
  if (command === 'whoami') return [gh, ['api', '--hostname', 'github.com', 'user', '--jq', '.login']];

  const repo = required('repo');
  if (!/^[a-z\d][a-z\d-]*\/[a-z\d_.-]+$/i.test(repo) || /\/(?:\.|\.\.|.*\.git)$/i.test(repo)) {
    throw new Error('--repo 必须为 github.com 上的 OWNER/REPO');
  }
  const target = `--repo=github.com/${repo}`;
  const number = () => {
    const value = required('number');
    if (!/^[1-9]\d*$/.test(value)) throw new Error('--number 必须为正整数');
    return value;
  };

  switch (command) {
    case 'repo':
      return [gh, ['repo', 'view', `github.com/${repo}`, '--json', 'nameWithOwner,url,defaultBranchRef']];
    case 'pr-list': {
      const filters = ['head', 'base'].filter((key) => args[key]).map((key) => `--${key}=${args[key]}`);
      return [gh, ['pr', 'list', target, '--state=all', '--json', 'number,url,state,headRefName,baseRefName', ...filters]];
    }
    case 'pr-view':
      return [gh, ['pr', 'view', number(), target, '--json', 'number,url,title,body,state,headRefOid,headRefName,headRepositoryOwner,baseRefName,reviewDecision,reviews,comments']];
    case 'pr-comments':
      return [gh, ['api', '--hostname', 'github.com', '--paginate', '--slurp', `repos/${repo}/pulls/${number()}/comments`]];
    case 'pr-checks':
      return [gh, ['pr', 'checks', number(), target]];
    case 'run-failures':
      return [gh, ['run', 'view', number(), target, '--log-failed']];
    case 'pr-create':
      return [gh, [
        'pr', 'create', target, `--head=${required('head')}`, `--base=${required('base')}`,
        `--title=${required('title')}`, `--body-file=${required('body-file')}`, ...(args.draft ? ['--draft'] : []),
      ]];
    case 'push':
    case 'remote-head': {
      const ref = `refs/heads/${required('branch')}`;
      const validation = spawnSync('git', ['check-ref-format', ref], { stdio: 'ignore', windowsHide: true });
      if (validation.error) throw new Error('请安装 Git，并确保本轮命令目录能找到 git');
      if (validation.status !== 0) throw new Error('--branch 必须为合法的 Git 分支名');
      const url = `https://github.com/${repo}.git`;
      // Git for Windows also runs shell credential helpers through sh.
      const path = process.platform === 'win32' ? gh.replaceAll('\\', '/') : gh;
      const quoted = "'" + path.replaceAll("'", "'\"'\"'") + "'";
      const settings = [
        '-c', 'credential.helper=',
        '-c', `credential.https://github.com.helper=!${quoted} auth git-credential`,
        '-c', 'core.askPass=',
        '-c', 'http.https://github.com/.extraHeader=',
        '-c', 'http.followRedirects=false',
      ];
      return ['git', command === 'push'
        ? [...settings, 'push', '--porcelain', '--no-follow-tags', '--recurse-submodules=no', '--', url, `${ref}:${ref}`]
        : [...settings, 'ls-remote', '--exit-code', '--refs', '--', url, ref]];
    }
    default:
      throw new Error(`未知 GitHub 命令：${command}`);
  }
}

async function main(argv) {
  if (!argv.length || (argv.length === 1 && ['-h', '--help'].includes(argv[0]))) {
    console.log(help);
    return 0;
  }

  const { values, positionals } = parseArgs({ args: argv, options, allowPositionals: true });
  if (positionals.length !== 1) throw new Error('请指定一个 GitHub 命令，使用 --help 查看用法');
  const [program, args] = resolveCommand(positionals[0], values);
  if (!values.connection) throw new Error('请通过 --connection FILE 选择 Workbench 的 GitHub 连接');
  let token;
  try {
    ({ token } = JSON.parse(readFileSync(values.connection, 'utf8')));
  } catch {
    throw new Error('无法读取所选 GitHub 连接，请从本轮插件配置选择有效连接');
  }
  if (typeof token !== 'string' || !token || /\s/.test(token)) {
    throw new Error('所选 GitHub 连接缺少有效格式的令牌');
  }

  const directory = mkdtempSync(join(tmpdir(), 'wb-gh-'));
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(?:GH_|GITHUB_TOKEN$|GITHUB_ENTERPRISE_TOKEN$|GIT_TRACE|GIT_CURL_VERBOSE$|GIT_ASKPASS$|SSH_ASKPASS$|DEBUG$)/i.test(key)
    ));
    return await run(program, args, {
      ...env,
      GH_TOKEN: token,
      GH_HOST: 'github.com',
      GH_CONFIG_DIR: directory,
      GH_PROMPT_DISABLED: '1',
      GH_NO_UPDATE_NOTIFIER: '1',
      GH_TELEMETRY: '0',
      GIT_TERMINAL_PROMPT: '0',
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
