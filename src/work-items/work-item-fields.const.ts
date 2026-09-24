export const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Start/due dates are calendar days (Postgres `date`), exchanged as `YYYY-MM-DD`. */
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `Date` (as Prisma returns a `date` column: midnight UTC) -> `YYYY-MM-DD`. */
export function toDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** `YYYY-MM-DD` -> `Date` at midnight UTC, the form Prisma expects for a `date` column. */
export function fromDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
