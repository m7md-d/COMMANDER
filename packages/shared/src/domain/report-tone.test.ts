/**
 * The register is the difference between a monitor people keep and one they mute.
 * These pin the two rules the operator asked for by name: forgive the first,
 * cheap mistake ("اغسلها"), and escalate on what is either serious or chronic.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { computeTone } from "./report-tone.js";

const ACTIVE = { stage: "active" as const, lifetimeCounts: {}, gravity: "routine" as const };

test("a clean push is commended, not merely spared", () => {
  const tone = computeTone({ ...ACTIVE, violations: [] });

  assert.equal(tone.level, "commend");
  assert.equal(tone.ruleId, null);
});

test("a first cheap slip is washed rather than prosecuted", () => {
  const tone = computeTone({
    ...ACTIVE,
    violations: ["weekend_ops"],
    lifetimeCounts: { weekend_ops: 1 },
  });

  assert.equal(tone.level, "wash");
  assert.equal(tone.repeats, 1);
});

test("the same slip, chronically repeated, stops being washed", () => {
  const tone = computeTone({
    ...ACTIVE,
    violations: ["weekend_ops"],
    lifetimeCounts: { weekend_ops: 12 },
  });

  assert.equal(tone.level, "firm");
  assert.equal(tone.repeats, 12);
});

test("a grave act is severe on its very first occurrence", () => {
  const tone = computeTone({
    ...ACTIVE,
    violations: ["force_push"],
    lifetimeCounts: { force_push: 1 },
  });

  assert.equal(tone.level, "severe");
});

test("the worst violation sets the register, not the count of small ones", () => {
  const tone = computeTone({
    ...ACTIVE,
    violations: ["weekend_ops", "night_ops", "lazy_message", "force_push"],
    lifetimeCounts: { weekend_ops: 9, night_ops: 9, lazy_message: 9, force_push: 1 },
  });

  assert.equal(tone.ruleId, "force_push");
  assert.equal(tone.level, "severe");
});

test("stage moves the whole scale: bootstrap forgives, frozen hardens", () => {
  const violations = {
    violations: ["direct_push" as const],
    lifetimeCounts: { direct_push: 1 },
    gravity: "routine" as const,
  };

  const bootstrap = computeTone({ ...violations, stage: "bootstrap" });
  const active = computeTone({ ...violations, stage: "active" });
  const frozen = computeTone({ ...violations, stage: "frozen" });

  assert.equal(bootstrap.level, "wash");
  assert.equal(active.level, "firm");
  assert.equal(frozen.level, "severe");
});

test("bootstrap forgives a step but never washes away a grave act", () => {
  const tone = computeTone({
    stage: "bootstrap",
    gravity: "routine",
    violations: ["force_push"],
    lifetimeCounts: { force_push: 6 },
  });

  assert.equal(tone.level, "firm");
});

test("the same slip lands harder on a protected branch than a scratch one", () => {
  const slip = {
    stage: "active" as const,
    violations: ["weekend_ops" as const],
    lifetimeCounts: { weekend_ops: 1 },
  };

  assert.equal(computeTone({ ...slip, gravity: "routine" }).level, "wash");
  assert.equal(computeTone({ ...slip, gravity: "guarded" }).level, "firm");
  assert.equal(computeTone({ ...slip, gravity: "critical" }).level, "severe");
});

test("gravity raises the register without ever touching what was examined", () => {
  const critical = computeTone({
    stage: "active",
    gravity: "critical",
    violations: ["lazy_message"],
    lifetimeCounts: { lazy_message: 1 },
  });

  // The rule that set the register is unchanged; only the register moved.
  assert.equal(critical.ruleId, "lazy_message");
  assert.equal(critical.repeats, 1);
  assert.equal(critical.level, "severe");
});
