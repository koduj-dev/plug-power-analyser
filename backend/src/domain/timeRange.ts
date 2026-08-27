import { DateTime } from 'luxon';

export interface TimeRange {
  startMs: number;
  endMs: number;
}

/** Start-of-today .. now, in the configured application timezone. */
export function todayRange(timezone: string, now: DateTime = DateTime.now().setZone(timezone)): TimeRange {
  const start = now.setZone(timezone).startOf('day');
  return { startMs: start.toMillis(), endMs: now.toMillis() };
}

/** Rolling 24h window ending now, timezone-agnostic (fixed duration). */
export function rolling24hRange(now: DateTime = DateTime.now()): TimeRange {
  return { startMs: now.minus({ hours: 24 }).toMillis(), endMs: now.toMillis() };
}
