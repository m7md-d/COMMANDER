/**
 * When a periodic report is due.
 *
 * The old rule was "one period after the last one", which meant the hour a
 * digest arrived was decided by whenever the schedule row happened to be created
 * — and drifted every time a send was late. An operator cannot plan around that,
 * and a report nobody can predict is a report nobody reads.
 *
 * So the schedule is now a named instant — a weekday and an hour in the
 * operator's own timezone — and lastRunAt records only which of those instants
 * has been served. Pure: `now` and the offset arrive as arguments, so a firing
 * decision can be tested without waiting for Monday.
 */

export interface ScheduleConfig {
  /** A disabled schedule never fires and never advances. */
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday, matching Date#getUTCDay. */
  dayOfWeek: number;
  /** 0–23, in the operator's local time (settings.timezoneOffset). */
  hour: number;
}

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: true,
  // Monday morning: the week it summarises is closed, and the people it names
  // are at their desks to read it.
  dayOfWeek: 1,
  hour: 9,
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * The scheduled instant a digest is owed for, or null when none is.
 *
 * Returns the **latest** missed instant, not the earliest. A laptop that was off
 * for three weeks owes one report covering three weeks, not three reports racing
 * each other into the channel — and the window it covers is printed on it, so
 * nothing is hidden by the compression. For the ordinary case of a single missed
 * instant the two readings are identical.
 *
 * The boundary is the scheduled instant itself and never `now`, which is what
 * stops the hour drifting later every week a tick runs slightly late.
 */
export function digestDueAt(input: {
  lastRunAt: Date | null;
  now: Date;
  config: ScheduleConfig;
  timezoneOffset: number;
}): Date | null {
  const { lastRunAt, now, config, timezoneOffset } = input;
  if (!config.enabled || lastRunAt === null) return null;

  const latest = lastScheduledAt(now, config, timezoneOffset);
  return latest.getTime() > lastRunAt.getTime() ? latest : null;
}

/**
 * The most recent instant matching the schedule at or before `now`.
 *
 * Computed by shifting into local time, walking back to the configured hour of
 * the configured weekday, and shifting out again — rather than by adding weeks
 * to an anchor, which accumulates the anchor's own minutes and seconds forever.
 */
export function lastScheduledAt(
  now: Date,
  config: ScheduleConfig,
  timezoneOffset: number,
): Date {
  const local = new Date(now.getTime() + timezoneOffset * HOUR_MS);

  // Truncate to the top of the configured hour on the same local day.
  const sameDay = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    config.hour,
  );

  // Then step back to the configured weekday. Both corrections are subtractions,
  // so the result is always at or before `now` — never a schedule in the future.
  const dayGap = (local.getUTCDay() - config.dayOfWeek + 7) % 7;
  let scheduled = sameDay - dayGap * DAY_MS;
  if (scheduled > local.getTime()) scheduled -= WEEK_MS;

  return new Date(scheduled - timezoneOffset * HOUR_MS);
}

/** Milliseconds in the digest's window when nothing else says otherwise — used
 *  for the very first manual report, which has no previous send to start from. */
export const DIGEST_PERIOD_MS = WEEK_MS;
