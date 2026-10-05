import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import config from './version-targets.mjs';
import { release, sync, checkVersion } from './version-control.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan build proof '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.resolve(import.meta.dirname, '..');
  for (const file of ['VERSION', ...config.targets.map((target) => target.path)]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(repo, file), path.join(root, file));
  }
  return root;
}
function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
const quiet = { log() {}, warn() {}, now: new Date('2026-10-05T00:00:00Z') };

test('standalone sync is metadata-only and preserves compiled shared output', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'shared/dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'shared/dist/index.js'), 'keep compiled bytes');
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
  fs.writeFileSync(path.join(root, 'VERSION'), '2026.10.3\n');
  assert.equal(sync(root, config, [], quiet), 0);
  const actual = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
  lock.version = '2026.10.3';
  for (const key of ['', 'backend', 'frontend', 'shared']) lock.packages[key].version = '2026.10.3';
  assert.deepEqual(actual, lock);
  assert.equal(fs.readFileSync(path.join(root, 'shared/dist/index.js'), 'utf8'), 'keep compiled bytes');
  assert.match(fs.readFileSync(path.join(root, 'shared/src/lib/version.ts'), 'utf8'), /VERSION = '2026.10.3'/);
  checkVersion(root, config);
});

test('shared compilation precedes Docker and either failure blocks real Git tagging', (t) => {
  for (const fail of ['npm', 'docker', null]) {
    const root = fixture(t);
    for (const args of [['init', '-b', 'fixture'], ['config', 'user.name', 'Fixture'], ['config', 'user.email', 'fixture@example.invalid'], ['config', 'commit.gpgsign', 'false'], ['config', 'tag.gpgsign', 'false'], ['add', '.'], ['commit', '-m', 'fixture']]) git(root, ...args);
    const head = git(root, 'rev-parse', 'HEAD'), calls = [];
    const code = release(root, config, ['--build', '--tag'], { ...quiet, run: (cwd, command, args, options) => {
      assert.equal(cwd, root);
      if (['npm', 'docker'].includes(command)) {
        calls.push([command, ...args]);
        if (command === fail) { const error = new Error('mock build failed'); error.status = 17; throw error; }
        return '';
      }
      return execFileSync(command, args, { cwd, encoding: 'utf8', ...options });
    } });
    assert.deepEqual(calls[0], ['npm', 'run', 'build', '--workspace=@nexkan/shared']);
    if (fail === 'npm') assert.equal(calls.length, 1);
    else assert.deepEqual(calls[1], ['docker', 'compose', 'build']);
    checkVersion(root, config);
    if (fail) {
      assert.equal(code, 1);
      assert.equal(git(root, 'rev-parse', 'HEAD'), head);
      assert.equal(git(root, 'tag', '--list'), '');
    } else {
      assert.equal(code, 0);
      assert.equal(git(root, 'cat-file', '-t', 'refs/tags/v2026.10.3'), 'tag');
    }
  }
});
