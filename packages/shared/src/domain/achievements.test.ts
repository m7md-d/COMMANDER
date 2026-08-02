import assert from "node:assert/strict";
import { test } from "node:test";
import { computeAchievements, type AchievementFacts } from "./achievements.js";

const BASE: AchievementFacts = {
  tier: "standard",
  cleanStreakDays: 0,
  totalCommits: 0,
  totalPushes: 0,
  totalViolations: 0,
  ruleCounts: {},
};

function ids(facts: Partial<AchievementFacts>): string[] {
  return computeAchievements({ ...BASE, ...facts }).map((a) => a.id);
}

test("a clean member with commits earns a spotless medal and nothing else", () => {
  const earned = computeAchievements({ ...BASE, tier: "exemplary", totalCommits: 30 });
  assert.deepEqual(earned, [{ id: "spotless", kind: "commendation", grade: "gold", value: 30 }]);
});

test("no commits and no violations earns nothing — an empty record, not a clean one", () => {
  assert.deepEqual(ids({}), []);
});

test("the first violation is marked, and clean_streak needs a prior record", () => {
  // A streak with zero violations is not a streak: it never earns clean_streak.
  assert.deepEqual(ids({ cleanStreakDays: 40, totalViolations: 0, totalCommits: 5 }), ["spotless"]);
  // With a real record, the same streak is a silver commendation.
  const earned = ids({ cleanStreakDays: 40, totalViolations: 3 });
  assert.ok(earned.includes("clean_streak"));
  assert.ok(earned.includes("first_blood"));
});

test("a serial offender collects the signature marks", () => {
  const earned = ids({
    tier: "probation",
    totalViolations: 20,
    ruleCounts: { direct_push: 12, night_ops: 4, batch_dump: 1 },
  });
  assert.ok(earned.includes("repeat_offender"));
  assert.ok(earned.includes("on_probation"));
  assert.ok(earned.includes("cowboy")); // 12 direct pushes
  assert.ok(earned.includes("night_owl")); // 4 night ops
  assert.ok(!earned.includes("dumper")); // only 1 batch dump, below bronze
});

test("grades climb with the tally", () => {
  const bronze = computeAchievements({ ...BASE, totalCommits: 60 }).find((a) => a.id === "prolific");
  const gold = computeAchievements({ ...BASE, totalCommits: 900 }).find((a) => a.id === "prolific");
  assert.equal(bronze?.grade, "bronze");
  assert.equal(gold?.grade, "gold");
});

test("redemption: violations behind, standing restored, streak held", () => {
  const earned = ids({ tier: "commended", totalViolations: 8, cleanStreakDays: 20 });
  assert.ok(earned.includes("redeemed"));
});
