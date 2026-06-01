#!/usr/bin/env node

const { execFileSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function usage() {
  process.stdout.write(`Sync all workspace package versions from a single source of truth (root package.json).

Usage:
  node ./scripts/sync-version.js [VERSION]

Arguments:
  VERSION   CalVer in YYYY.M.D or vYYYY.M.D format.
            If omitted, defaults to today's date.

Examples:
  node ./scripts/sync-version.js
  node ./scripts/sync-version.js 2026.6.1
  node ./scripts/sync-version.js v2026.6.1

Notes:
  - Root package.json is the single source of truth.
  - This script updates root + backend + frontend + shared versions.
  - package-lock.json is refreshed to keep version metadata in sync.
`);
}

function todayCalVer() {
  const now = new Date();
  return `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`;
}

function runNpm(args) {
  execFileSync('npm', args, {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
}

function getRootVersion() {
  const out = execFileSync('npm', ['pkg', 'get', 'version'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  return out.trim().replace(/^"|"$/g, '');
}

const arg = process.argv[2];
if (arg === '-h' || arg === '--help') {
  usage();
  process.exit(0);
}

const rawVersion = arg || todayCalVer();
const version = rawVersion.replace(/^v/, '');

if (!/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(version)) {
  process.stderr.write(`Invalid CalVer: ${rawVersion}\n`);
  process.stderr.write('Expected: YYYY.M.D or vYYYY.M.D\n\n');
  usage();
  process.exit(1);
}

try {
  runNpm(['pkg', 'set', `version=${version}`]);
  const rootVersion = getRootVersion();

  runNpm(['pkg', 'set', '--workspace=nexkan-backend', `version=${rootVersion}`]);
  runNpm(['pkg', 'set', '--workspace=nexkan-frontend', `version=${rootVersion}`]);
  runNpm(['pkg', 'set', '--workspace=@nexkan/shared', `version=${rootVersion}`]);

  runNpm(['install', '--package-lock-only']);

  process.stdout.write(`Synced versions to ${rootVersion}\n`);
  process.stdout.write('Root source of truth: package.json\n');
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  process.stderr.write(`Failed to sync version: ${message}\n`);
  process.exit(1);
}
