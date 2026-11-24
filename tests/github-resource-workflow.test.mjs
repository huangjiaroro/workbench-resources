import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('GitHub connection clones the selected repo, then fetches without changing the checked out branch', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'github-resource-development-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = join(root, 'remote');
  const clone = join(root, 'clone');
  const config = join(root, 'credentials.json');
  writeFileSync(config, JSON.stringify({ token: 'local-test-token' }), { mode: 0o600 });
  const git = (cwd, ...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(root, 'init', '-b', 'main', remote);
  git(remote, 'config', 'user.name', 'Workbench Test');
  git(remote, 'config', 'user.email', 'test@example.invalid');
  writeFileSync(join(remote, 'README.md'), 'Original source\n');
  git(remote, 'add', 'README.md');
  git(remote, 'commit', '-m', 'Initial source');
  const wrapper = fileURLToPath(new URL('../resources/extensions/plugins/github/scripts/github.mjs', import.meta.url));
  const cli = (cwd, ...args) => spawnSync(process.execPath,
    [wrapper, '--connection', config, ...args, '--repo', 'test/resources'], {
      cwd,
      env: { ...process.env,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: `url.${pathToFileURL(remote).href}.insteadOf`,
        GIT_CONFIG_VALUE_0: 'https://github.com/test/resources.git',
      },
      encoding: 'utf8',
    });
  assert.notEqual(cli(root, 'clone', '--directory', 'relative').status, 0);
  const cloned = cli(root, 'clone', '--directory', clone);
  assert.equal(cloned.status, 0, cloned.stderr);
  const head = git(clone, 'rev-parse', 'HEAD');
  assert.equal(head, git(remote, 'rev-parse', 'HEAD'));
  writeFileSync(join(remote, 'README.md'), 'New source\n');
  git(remote, 'commit', '-am', 'Update source');
  const fetched = cli(clone, 'fetch', '--branch', 'main');
  assert.equal(fetched.status, 0, fetched.stderr);
  assert.equal(git(clone, 'rev-parse', 'FETCH_HEAD'), git(remote, 'rev-parse', 'HEAD'));
  assert.equal(git(clone, 'rev-parse', 'HEAD'), head);
});
