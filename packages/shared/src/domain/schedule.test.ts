/**
 * When a digest fires, tested without waiting for Monday.
 *
 * The cases that matter are the ones nobody would notice going wrong: a tick
 * that runs late must not move the slot, a re-enabled schedule must not flood
 * the channel, and a manual reading must leave the anchor exactly where it was
 * (which is asserted in the scheduler, not here — this file owns only the
 * arithmetic).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SCHEDULE, digestDueAt, lastScheduledAt } from "./schedule.js";

/** Monday 09:00 at UTC+3 is Monday 06:00 UTC. */
const RIYADH = 3;
const MONDAY_9 = { enabled: true, dayOfWeek: 1, hour: 9 };

const at = (iso: string) => new Date(iso);

test("the slot is the most recent matching instant, never now", () => {
  // Wednesday 2026-07-29, 14:37 local (11:37Z).
  const slot = lastScheduledAt(at("2026-07-29T11:37:00Z"), MONDAY_9, RIYADH);

  assert.equal(slot.toISOString(), "2026-07-27T06:00:00.000Z", "Monday 09:00 +03");
});

test("before the hour on the day itself, the slot is the previous week", () => {
  // Monday 08:30 local — the 09:00 slot has not arrived yet.
  const slot = lastScheduledAt(at("2026-07-27T05:30:00Z"), MONDAY_9, RIYADH);

  assert.equal(slot.toISOString(), "2026-07-20T06:00:00.000Z");
});

test("a tick running forty minutes late still closes the window on the hour", () => {
  const due = digestDueAt({
    lastRunAt: at("2026-07-20T06:00:00Z"),
    now: at("2026-07-27T06:40:00Z"),
    config: MONDAY_9,
    timezoneOffset: RIYADH,
  });

  assert.equal(due?.toISOString(), "2026-07-27T06:00:00.000Z", "not 06:40 — the hour cannot drift");
});

test("running late does not push next week's slot later", () => {
  const first = digestDueAt({
    lastRunAt: at("2026-07-20T06:00:00Z"),
    now: at("2026-07-27T06:40:00Z"),
    config: MONDAY_9,
    timezoneOffset: RIYADH,
  });
  const second = digestDueAt({
    lastRunAt: first,
    now: at("2026-08-03T07:55:00Z"),
    config: MONDAY_9,
    timezoneOffset: RIYADH,
  });

  assert.equal(second?.toISOString(), "2026-08-03T06:00:00.000Z");
});

test("three missed weeks produce one report covering three weeks", () => {
  const due = digestDueAt({
    lastRunAt: at("2026-07-06T06:00:00Z"),
    now: at("2026-07-27T10:00:00Z"),
    config: MONDAY_9,
    timezoneOffset: RIYADH,
  });

  // The latest missed slot, not the earliest: three reports racing into the
  // channel would be read as a malfunction, and the window is printed anyway.
  assert.equal(due?.toISOString(), "2026-07-27T06:00:00.000Z");
});

test("nothing is due between slots", () => {
  const due = digestDueAt({
    lastRunAt: at("2026-07-27T06:00:00Z"),
    now: at("2026-07-30T12:00:00Z"),
    config: MONDAY_9,
    timezoneOffset: RIYADH,
  });

  assert.equal(due, null);
});

test("a disabled schedule is never due", () => {
  const due = digestDueAt({
    lastRunAt: at("2026-07-06T06:00:00Z"),
    now: at("2026-07-27T10:00:00Z"),
    config: { ...MONDAY_9, enabled: false },
    timezoneOffset: RIYADH,
  });

  assert.equal(due, null, "and the anchor is left where it was, so re-enabling reports the gap");
});

test("an unanchored schedule is never due", () => {
  // A front seen for the first time: a week nobody was watching is not summarised.
  assert.equal(digestDueAt({
      lastRunAt: null,
      now: at("2026-07-27T10:00:00Z"),
      config: MONDAY_9,
      timezoneOffset: RIYADH,
    }), null);
});

test("the offset moves the slot, not the weekday it lands on", () => {
  const east = lastScheduledAt(at("2026-07-29T00:00:00Z"), MONDAY_9, 3);
  const west = lastScheduledAt(at("2026-07-29T00:00:00Z"), MONDAY_9, -8);

  assert.equal(east.toISOString(), "2026-07-27T06:00:00.000Z");
  assert.equal(west.toISOString(), "2026-07-27T17:00:00.000Z");
});

test("midnight and Sunday are ordinary values, not edge cases", () => {
  const sundayMidnight = { enabled: true, dayOfWeek: 0, hour: 0 };
  const slot = lastScheduledAt(at("2026-07-29T11:00:00Z"), sundayMidnight, RIYADH);

  assert.equal(slot.toISOString(), "2026-07-25T21:00:00.000Z", "Sunday 00:00 +03");
});

test("the shipped default is a real, firing schedule", () => {
  assert.equal(DEFAULT_SCHEDULE.enabled, true);
  const due = digestDueAt({
    lastRunAt: at("2026-07-20T06:00:00Z"),
    now: at("2026-07-27T12:00:00Z"),
    config: DEFAULT_SCHEDULE,
    timezoneOffset: RIYADH,
  });
  assert.ok(due, "a front that configured nothing still gets its harvest");
});
