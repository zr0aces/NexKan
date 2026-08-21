import { execFileSync } from 'child_process';
import path from 'path';

describe('Root maintenance scripts', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  function runScript(scriptPath: string, args: string[]): { stdout: string; exitCode: number } {
    try {
      const stdout = execFileSync('node', [scriptPath, ...args], {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { stdout, exitCode: 0 };
    } catch (err: any) {
      return { stdout: (err.stdout || '') + (err.stderr || ''), exitCode: err.status ?? 1 };
    }
  }

  describe('sync-version.mjs', () => {
    it('succeeds with --check flag when repo versions are in sync', () => {
      const { stdout, exitCode } = runScript('./scripts/sync-version.mjs', ['--check']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('consistently in sync');
    });

    it('prints help message with --help flag', () => {
      const { stdout, exitCode } = runScript('./scripts/sync-version.mjs', ['--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Usage:');
    });
  });

  describe('release.mjs', () => {
    it('prints help message with --help flag', () => {
      const { stdout, exitCode } = runScript('./scripts/release.mjs', ['--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('--build');
      expect(stdout).toContain('--tag');
    });

    it('rejects invalid CalVer format', () => {
      const { stdout, exitCode } = runScript('./scripts/release.mjs', ['invalid-version']);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('Invalid CalVer');
    });
  });
});
