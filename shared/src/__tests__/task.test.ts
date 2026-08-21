import { describe, it, expect } from 'vitest';
import { TASK_STATUSES, requiresDueDate, isOverdue } from '../lib/task';

describe('Shared task domain rules', () => {
  it('defines the standard TASK_STATUSES', () => {
    expect(TASK_STATUSES).toEqual(['todo', 'in-progress', 'done']);
  });

  describe('requiresDueDate', () => {
    it('returns true for todo and in-progress', () => {
      expect(requiresDueDate('todo')).toBe(true);
      expect(requiresDueDate('in-progress')).toBe(true);
    });

    it('returns false for done', () => {
      expect(requiresDueDate('done')).toBe(false);
    });
  });

  describe('isOverdue', () => {
    const today = new Date(2026, 7, 21); // Aug 21, 2026

    it('returns false if status is done even if past due date', () => {
      expect(isOverdue('2026-08-10', 'done', today)).toBe(false);
    });

    it('returns true if due date is before today and status is todo or in-progress', () => {
      expect(isOverdue('2026-08-20', 'todo', today)).toBe(true);
      expect(isOverdue('2026-08-20', 'in-progress', today)).toBe(true);
    });

    it('returns false if due date is today or in future', () => {
      expect(isOverdue('2026-08-21', 'todo', today)).toBe(false);
      expect(isOverdue('2026-08-22', 'todo', today)).toBe(false);
      expect(isOverdue('2026-09-01', 'in-progress', today)).toBe(false);
    });
  });
});
