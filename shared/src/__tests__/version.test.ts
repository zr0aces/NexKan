import { describe, it, expect } from 'vitest';
import { VERSION } from '../lib/version';

describe('Shared version export', () => {
  it('exports a valid CalVer format version string', () => {
    expect(typeof VERSION).toBe('string');
    expect(/^\d{4}\.\d{1,2}\.\d+$/.test(VERSION)).toBe(true);
  });
});
