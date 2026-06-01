import { parse, format } from 'date-fns';

const STORAGE_FORMAT = 'yyyy-MM-dd';

/**
 * Parse a stored YYYY-MM-DD string as LOCAL midnight.
 *
 * Uses parse() with an explicit format token instead of parseISO() to
 * guarantee local-time interpretation regardless of date-fns version.
 * (date-fns v2 parseISO treated date-only strings as UTC midnight, which
 * would shift the displayed date by ±1 day in UTC-negative timezones.)
 *
 * The server's local timezone is controlled by the TZ environment variable.
 * It must be set to the user's timezone for overdue/due-today/due-tomorrow
 * classifications to match what the user sees in their browser.
 */
export function parseLocalDate(dateStr: string): Date {
  return parse(dateStr, STORAGE_FORMAT, new Date());
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  return format(d, 'dd MMM yyyy');
}
