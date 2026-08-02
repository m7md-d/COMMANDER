/**
 * Fixed-offset local time.
 *
 * A full timezone database would handle DST correctly but adds weight for a
 * feature whose only consumers are "was this commit at 3am" and "was it on a
 * weekend". The documented trade-off (CONSTITUTION.md §1, settings.ts) is a
 * one-hour drift for teams in DST regions during part of the year.
 */

const MS_PER_HOUR = 3_600_000;

export function localHour(timestamp: string, offsetHours: number): number | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return (((date.getUTCHours() + offsetHours) % 24) + 24) % 24;
}

/** 0 = Sunday, matching JavaScript's getUTCDay and the day.* i18n keys. */
export function localWeekday(timestamp: string, offsetHours: number): number | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + offsetHours * MS_PER_HOUR).getUTCDay();
}

/**
 * Inclusive on both ends, and handles windows that wrap past midnight — a
 * 23→05 night window is the common case and a naive `hour >= start && hour <=
 * end` silently never fires for it.
 */
export function hourInWindow(hour: number, startHour: number, endHour: number): boolean {
  return startHour <= endHour
    ? hour >= startHour && hour <= endHour
    : hour >= startHour || hour <= endHour;
}
