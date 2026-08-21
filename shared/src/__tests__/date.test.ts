import { describe, it, expect } from 'vitest';
import { parseLocalDate, formatDate } from '../lib/date';

describe('Shared date utils', () => {
  describe('parseLocalDate', () => {
    it('parses YYYY-MM-DD as local date correctly without UTC shift', () => {
      const parsed = parseLocalDate('2026-08-30');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(7); // 0-indexed August
      expect(parsed.getDate()).toBe(30);
    });
  });

  describe('formatDate', () => {
    it('formats a date string to dd MMM yyyy', () => {
      expect(formatDate('2026-08-30')).toBe('30 Aug 2026');
      expect(formatDate('2026-01-05')).toBe('05 Jan 2026');
    });

    it('formats a Date object to dd MMM yyyy', () => {
      const date = new Date(2026, 7, 30);
      expect(formatDate(date)).toBe('30 Aug 2026');
    });
  });
});
