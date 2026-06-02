#!/usr/bin/env node

const { execFileSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function usage() {
  process.stdout.write(`Prepare a release using CalVer and print required Git tag commands.

Usage:
  node ./scripts/release.js [VERSION]

Arguments:
  VERSION   CalVer in YYYY.M.PATCH or vYYYY.M.PATCH format.
            If omitted, auto-increments the patch version for the current month.

Examples:
  node ./scripts/release.js
  node ./scripts/release.js 2026.6.1
  node ./scripts/release.js v2026.6.1

What this does:
  1. Runs sync-version to update versions across the codebase.
  2. Prints the git commands required to tag and push the release.
`);
}

function runNode(args) {
  execFileSync('node', args, {
    cwd: rootDir,
    stdio: 'inherit',
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

function getCurrentBranch() {
  try {
    const { execSync } = require('child_process');
    return execSync('git branch --show-current', {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim() || 'main';
  } catch (e) {
    return 'main';
  }
}

const arg = process.argv[2];
if (arg === '-h' || arg === '--help') {
  usage();
  process.exit(0);
}

try {
  if (arg) {
    runNode(['./scripts/sync-version.js', arg]);
  } else {
    runNode(['./scripts/sync-version.js']);
  }

  const version = getRootVersion();
  const tag = `v${version}`;
  const branch = getCurrentBranch();

  process.stdout.write(`\nRelease version prepared: ${version}\n\n`);
  process.stdout.write('Run these commands after reviewing changes:\n');
  process.stdout.write('  git add package.json package-lock.json backend/package.json frontend/package.json shared/package.json shared/src/lib/version.ts\n');
  process.stdout.write(`  git commit -m "chore(release): ${tag}"\n`);
  process.stdout.write(`  git tag -a "${tag}" -m "Release ${tag}"\n`);
  process.stdout.write(`  git push origin ${branch}\n`);
  process.stdout.write(`  git push origin "${tag}"\n`);
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  process.stderr.write(`Failed to prepare release: ${message}\n`);
  process.exit(1);
}
