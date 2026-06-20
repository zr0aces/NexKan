#!/usr/bin/env node

import { execFileSync, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function usage() {
  process.stdout.write(`Prepare a release using CalVer and print required Git tag commands.

Usage:
  node ./scripts/release.mjs [VERSION] [--build] [--tag]

Arguments:
  VERSION   CalVer in YYYY.M.PATCH or vYYYY.M.PATCH format.
            If omitted, auto-increments the patch version for the current month.

Options:
  --build   Build version-tagged Docker compose images.
  --tag     Automatically stage, commit, and tag the release in Git.

Examples:
  node ./scripts/release.mjs
  node ./scripts/release.mjs 2026.6.14
  node ./scripts/release.mjs --tag --build
`);
}

function runNode(args) {
  execFileSync('node', args, {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim() || 'main';
  } catch (e) {
    return 'main';
  }
}

function getNextCalVer(currentVer) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed, no leading zero

  try {
    const parts = currentVer.split('.').map(Number);
    if (parts.length < 3 || parts.some(isNaN)) {
      return `${currentYear}.${currentMonth}.1`;
    }
    const prevYear = parts[0];
    const prevMonth = parts[1];
    const prevPatch = parts[2];

    // If the year or month has changed, reset patch/minor-fix to 1
    if (currentYear > prevYear || (currentYear === prevYear && currentMonth > prevMonth)) {
      return `${currentYear}.${currentMonth}.1`;
    }

    // Otherwise, increment the patch/minor-fix number by 1
    return `${prevYear}.${prevMonth}.${prevPatch + 1}`;
  } catch (e) {
    return `${currentYear}.${currentMonth}.1`;
  }
}

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  usage();
  process.exit(0);
}

const buildFlag = args.includes('--build');
const tagFlag = args.includes('--tag');

// Extract the version argument if present (it should not start with -)
const versionArg = args.find(arg => !arg.startsWith('-'));

const versionFilePath = path.resolve(rootDir, 'VERSION');
let currentVersion;
if (fs.existsSync(versionFilePath)) {
  currentVersion = fs.readFileSync(versionFilePath, 'utf8').trim();
} else {
  try {
    const rootPkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
    currentVersion = rootPkg.version;
  } catch (e) {
    const now = new Date();
    currentVersion = `${now.getFullYear()}.${now.getMonth() + 1}.0`;
  }
}

let targetVersion;
if (versionArg) {
  targetVersion = versionArg.replace(/^v/, '');
  if (!/^\d{4}\.\d{1,2}\.\d+$/.test(targetVersion)) {
    process.stderr.write(`Invalid CalVer: ${versionArg}\n`);
    process.stderr.write('Expected format: YYYY.M.PATCH or vYYYY.M.PATCH\n\n');
    usage();
    process.exit(1);
  }
} else {
  targetVersion = getNextCalVer(currentVersion);
}

try {
  // Write the new version back to the VERSION file (single source of truth)
  fs.writeFileSync(versionFilePath, `${targetVersion}\n`, 'utf8');
  process.stdout.write(`Updated VERSION file to: ${targetVersion}\n`);

  // Run sync-version.mjs to propagate version metadata
  runNode(['./scripts/sync-version.mjs']);

  if (buildFlag) {
    process.stdout.write('\nBuilding Docker images...\n');
    try {
      execFileSync('docker', ['compose', 'build'], {
        cwd: rootDir,
        stdio: 'inherit',
      });
    } catch (error) {
      process.stderr.write(`Warning: docker compose build failed: ${error.message}\n`);
    }
  }

  const tag = `v${targetVersion}`;
  const branch = getCurrentBranch();

  if (tagFlag) {
    process.stdout.write('\nStaging, committing, and tagging release in Git...\n');
    execFileSync('git', ['add', 'VERSION', 'package.json', 'package-lock.json', 'backend/package.json', 'frontend/package.json', 'shared/package.json', 'shared/src/lib/version.ts'], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    execFileSync('git', ['commit', '-m', `chore(release): ${tag}`], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    execFileSync('git', ['tag', '-a', tag, '-m', `Release ${tag}`], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    process.stdout.write(`Successfully created commit and tag ${tag}!\n`);
  }

  process.stdout.write(`\nRelease version prepared: ${targetVersion}\n\n`);
  if (tagFlag) {
    process.stdout.write('Run these commands to push the release:\n');
    process.stdout.write(`  git push origin ${branch}\n`);
    process.stdout.write(`  git push origin "${tag}"\n`);
  } else {
    process.stdout.write('Run these commands after reviewing changes:\n');
    process.stdout.write('  git add VERSION package.json package-lock.json backend/package.json frontend/package.json shared/package.json shared/src/lib/version.ts\n');
    process.stdout.write(`  git commit -m "chore(release): ${tag}"\n`);
    process.stdout.write(`  git tag -a "${tag}" -m "Release ${tag}"\n`);
    process.stdout.write(`  git push origin ${branch}\n`);
    process.stdout.write(`  git push origin "${tag}"\n`);
  }
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  process.stderr.write(`Failed to prepare release: ${message}\n`);
  process.exit(1);
}
