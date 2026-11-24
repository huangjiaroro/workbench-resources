import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const help = `wb-github --connection FILE <command> [options]
  auth-status | auth-login | auth-logout --auth-directory DIRECTORY
  repo-create  --repo OWNER/REPO --visibility private|public [--directory LOCAL_REPOSITORY]
  whoami
  repo         --repo OWNER/REPO
  pr-list      --repo OWNER/REPO [--head BRANCH] [--base BRANCH]
  pr-view      --repo OWNER/REPO --number PR
  pr-comments  --repo OWNER/REPO --number PR
  pr-checks    --repo OWNER/REPO --number PR
  run-failures --repo OWNER/REPO --number RUN
  clone        --repo OWNER/REPO --directory ABSOLUTE_PATH
  fetch        --repo OWNER/REPO --branch BRANCH
  push         --repo OWNER/REPO --branch BRANCH
  remote-head  --repo OWNER/REPO --branch BRANCH
  pr-create    --repo OWNER/REPO --head BRANCH --base BRANCH --title TITLE --body-file FILE [--draft]`;

const gh = fileURLToPath(new URL(process.platform === 'win32' ? './bin/gh.exe' : './bin/gh', import.meta.url));
const options = Object.fromEntries(
  ['auth-directory', 'visibility', 'connection', 'repo', 'number', 'head', 'base', 'branch', 'directory', 'title', 'body-file'].map(
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
    case 'repo-create': {
      const visibility = required('visibility');
      if (!['private', 'public'].includes(visibility)) throw new Error('--visibility 必须为 private 或 public');
      if (args.directory && !isAbsolute(args.directory)) throw new Error('--directory 必须为绝对路径');
      return [gh, ['repo', 'create', repo, '--' + visibility, ...(args.directory ? ['--source', args.directory, '--remote', 'origin', '--push'] : [])]];
    }
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
    case 'clone':
    case 'fetch':
    case 'push':
    case 'remote-head': {
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
      if (command === 'clone') {
        const directory = required('directory');
        if (!isAbsolute(directory)) throw new Error('--directory 必须为绝对路径');
        return ['git', [...settings, 'clone', '--', url, directory]];
      }
      const ref = `refs/heads/${required('branch')}`;
      const validation = spawnSync('git', ['check-ref-format', ref], { stdio: 'ignore', windowsHide: true });
      if (validation.error) throw new Error('请安装 Git，并确保本轮命令目录能找到 git');
      if (validation.status !== 0) throw new Error('--branch 必须为合法的 Git 分支名');
      if (command === 'fetch') {
        return ['git', [...settings, 'fetch', '--no-tags', '--no-recurse-submodules', '--', url, ref]];
      }
      return ['git', command === 'push'
        ? [...settings, 'push', '--porcelain', '--no-follow-tags', '--recurse-submodules=no', '--', url, `${ref}:${ref}`]
        : [...settings, 'ls-remote', '--exit-code', '--refs', '--', url, ref]];
    }
    default:
      throw new Error(`未知 GitHub 命令：${command}`);
  }
}

async function authenticate(operation, directory) {
  if (!directory || !isAbsolute(directory)) throw new Error('认证目录必须为绝对路径');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:GH_|GITHUB_TOKEN$|GITHUB_ENTERPRISE_TOKEN$)/i.test(key)));
  Object.assign(env, { GH_HOST: 'github.com', GH_CONFIG_DIR: directory, GH_NO_UPDATE_NOTIFIER: '1', GH_TELEMETRY: '0', LC_ALL: 'C' });
  const report = value => console.log(JSON.stringify(value));
  const user = () => {
    const result = spawnSync(gh, ['api', '--hostname', 'github.com', 'user', '--jq', '.login'], { env, encoding: 'utf8', timeout: 20000, windowsHide: true });
    if (result.status !== 0) return null;
    const login = result.stdout.trim();
    return /^[a-z\d][a-z\d-]*$/i.test(login) ? login : null;
  };
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const legacy = input ? JSON.parse(input) : {};
  if (operation === 'auth-status') {
    if (existsSync(join(directory, '.signed-out'))) { report({ state: 'signed-out' }); return 0; }
    if (!existsSync(join(directory, 'hosts.yml'))) {
      if (!existsSync(join(directory, '.signed-out')) && legacy.token) env.GH_TOKEN = legacy.token;
      else { report({ state: 'signed-out' }); return 0; }
    }
    const login = user();
    report(login ? { state: 'signed-in', login } : { state: 'error', error: 'GitHub 登录失效或暂时无法连接，请重新登录。' });
    return 0;
  }
  if (operation === 'auth-logout') {
    const login = existsSync(join(directory, 'hosts.yml')) ? user() : null;
    if (login) {
      const result = spawnSync(gh, ['auth', 'logout', '--hostname', 'github.com', '--user', login], { env, encoding: 'utf8', timeout: 20000, windowsHide: true });
      if (result.status !== 0) throw new Error('退出 GitHub 登录失败，请稍后重试');
    }
    writeFileSync(join(directory, '.signed-out'), '', { mode: 0o600 });
    report({ state: 'signed-out' }); return 0;
  }
  if (operation !== 'auth-login') throw new Error('未知认证操作');
  const child = spawn(gh, ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web'], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '', notified = false;
  const receive = chunk => {
    output = (output + chunk.toString()).slice(-12000);
    const match = /one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i.exec(output);
    if (match && !notified) { notified = true; report({ state: 'pending', url: 'https://github.com/login/device', code: match[1] }); }
  };
  child.stdout.on('data', receive); child.stderr.on('data', receive);
  const stop = () => child.kill('SIGTERM');
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  try {
    const code = await new Promise((accept, reject) => { child.once('error', reject); child.once('close', accept); });
    if (code !== 0) { report({ state: 'error', error: 'GitHub 浏览器授权未完成，请重新登录。' }); return 1; }
    rmSync(join(directory, '.signed-out'), { force: true });
    const login = user();
    if (!login) throw new Error('授权已返回，但未能确认 GitHub 账号，请检查连接');
    report({ state: 'signed-in', login }); return 0;
  } finally { process.off('SIGTERM', stop); process.off('SIGINT', stop); }
}

async function main(argv) {
  if (!argv.length || (argv.length === 1 && ['-h', '--help'].includes(argv[0]))) {
    console.log(help);
    return 0;
  }

  const { values, positionals } = parseArgs({ args: argv, options, allowPositionals: true });
  if (positionals.length !== 1) throw new Error('请指定一个 GitHub 命令，使用 --help 查看用法');
  if (positionals[0].startsWith('auth-')) return authenticate(positionals[0], values['auth-directory']);
  const [program, args] = resolveCommand(positionals[0], values);
  let configuration = {};
  if (values.connection) {
    try { configuration = JSON.parse(readFileSync(values.connection, 'utf8')); }
    catch { throw new Error('无法读取 GitHub 登录配置，请使用本轮插件提供的配置路径'); }
  }
  const directory = values['auth-directory'] || configuration.authDirectory;
  if (directory && !isAbsolute(directory)) throw new Error('认证目录必须为绝对路径');
  const temporary = directory ? null : mkdtempSync(join(tmpdir(), 'wb-gh-'));
  const root = directory || temporary;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(?:GH_|GITHUB_TOKEN$|GITHUB_ENTERPRISE_TOKEN$|GIT_TRACE|GIT_CURL_VERBOSE$|GIT_ASKPASS$|SSH_ASKPASS$|DEBUG$)/i.test(key)
  ));
  Object.assign(env, { GH_HOST: 'github.com', GH_CONFIG_DIR: root, GH_NO_UPDATE_NOTIFIER: '1', GH_TELEMETRY: '0', GIT_TERMINAL_PROMPT: '0' });
  // Existing credentials remain usable until the user explicitly logs in or out.
  if ((!directory || (!existsSync(join(directory, 'hosts.yml')) && !existsSync(join(directory, '.signed-out')))) && configuration.token) {
    if (typeof configuration.token !== 'string' || /\s/.test(configuration.token)) throw new Error('已有 GitHub 凭据格式无效，请重新登录');
    env.GH_TOKEN = configuration.token;
  }
  try {
    if (directory && existsSync(join(directory, '.signed-out'))) throw new Error('请先在 GitHub 插件中登录');
    return await run(program, args, { ...env, GH_PROMPT_DISABLED: '1' });
  }
  finally { if (temporary) rmSync(temporary, { recursive: true, force: true }); }

}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
