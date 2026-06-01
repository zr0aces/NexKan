import { startOfDay } from 'date-fns';
import { parseLocalDate } from './date';
import type { TaskStatus } from '../types/task';

/** Single source of truth for valid task statuses. */
export const TASK_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

/**
 * Returns true if moving a task to `status` requires a due date.
 * Replaces 4 separate inline checks: store.ts×2, move.ts, TaskDialog.tsx.
 */
export function requiresDueDate(status: TaskStatus): boolean {
  return status === 'todo' || status === 'in-progress';
}

/**
 * Returns true if the task is overdue (due date before today, status not done).
 * Replaces 3 equivalent implementations: store.ts, TaskCard.tsx, DashboardPage.tsx.
 *
 * @param dueDate  YYYY-MM-DD stored date string
 * @param status   Current task status
 * @param today    Reference date (defaults to now; pass pre-computed value for batch ops)
 */
export function isOverdue(
  dueDate: string,
  status: TaskStatus,
  today: Date = new Date()
): boolean {
  if (status === 'done') return false;
  return startOfDay(parseLocalDate(dueDate)) < startOfDay(today);
}
