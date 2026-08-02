import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HALF_LIFE_DAYS,
  decayFactor,
  factsFingerprint,
  scoreDossier,
  tierForScore,
} from "./dossier.js";
import type { RuleId } from "./violations.js";

const NOW = new Date("2026-07-01T12:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function events(spec: [RuleId, number][]) {
  return spec.map(([ruleId, days]) => ({ ruleId, occurredAt: daysAgo(days) }));
}

test("decay halves the weight every half-life", () => {
  assert.equal(decayFactor(0), 1);
  assert.equal(decayFactor(HALF_LIFE_DAYS), 0.5);
  assert.ok(Math.abs(decayFactor(HALF_LIFE_DAYS * 2) - 0.25) < 1e-9);
});

test("a fresh violation outweighs an identical old one", () => {
  const fresh = scoreDossier(events([["force_push", 1]]), { now: NOW });
  const old = scoreDossier(events([["force_push", 180]]), { now: NOW });
  assert.ok(fresh.riskScore > old.riskScore * 10);
});

test("severity ranks a force push above a lazy message", () => {
  const forced = scoreDossier(events([["force_push", 1]]), { now: NOW });
  const lazy = scoreDossier(events([["lazy_message", 1]]), { now: NOW });
  assert.ok(forced.riskScore > lazy.riskScore);
});

test("an old unrepeated burst is discounted as an anomaly", () => {
  // Four force pushes inside one day, then silence for ~4 half-lives.
  const burst = scoreDossier(
    events([
      ["force_push", 122],
      ["force_push", 122],
      ["force_push", 121.5],
      ["force_push", 121],
    ]),
    { now: NOW },
  );

  assert.equal(burst.anomalyCount, 4);
  assert.ok(burst.events.every((event) => event.discountedAsAnomaly));
});

test("a recent burst is NOT discounted — it is a live pattern", () => {
  const recent = scoreDossier(
    events([
      ["force_push", 2],
      ["force_push", 1.5],
      ["force_push", 1],
    ]),
    { now: NOW },
  );

  assert.equal(recent.anomalyCount, 0);
  assert.ok(recent.riskScore > 5);
});

test("ongoing repetition is not treated as an anomaly even when it started long ago", () => {
  const chronic = scoreDossier(
    events([
      ["direct_push", 120],
      ["direct_push", 119.5],
      ["direct_push", 119],
      ["direct_push", 3],
    ]),
    { now: NOW },
  );

  // The old cluster is not the last cluster, so silence never applied.
  assert.equal(chronic.anomalyCount, 0);
});

test("a clean streak repays standing but cannot erase a severe record", () => {
  const withStreak = scoreDossier(events([["force_push", 200]]), { now: NOW });
  assert.ok(withStreak.redemptionCredit > 0);
  assert.ok(withStreak.riskScore >= 0, "score is never negative");

  const severe = scoreDossier(
    events([
      ["force_push", 1],
      ["force_push", 2],
      ["branch_deleted", 1],
      ["force_push", 3],
      ["direct_push", 1],
    ]),
    { now: NOW },
  );
  assert.ok(severe.riskScore > 6, "recent severe record survives redemption");
});

test("a spotless record lands in the top tier", () => {
  const clean = scoreDossier([], { now: NOW });
  assert.equal(clean.riskScore, 0);
  assert.equal(clean.tier, "exemplary");
});

test("tier boundaries are ordered and total", () => {
  const ordered = [0, 1, 4, 9, 18, 40].map(tierForScore);
  assert.deepEqual(ordered, [
    "exemplary",
    "commended",
    "standard",
    "watch",
    "probation",
    "court_martial",
  ]);
});

test("byRule breakdown sums to the pre-redemption total", () => {
  const score = scoreDossier(
    events([
      ["force_push", 5],
      ["lazy_message", 10],
      ["night_ops", 2],
    ]),
    { now: NOW },
  );

  const summed = Object.values(score.byRule).reduce((total, value) => total + (value ?? 0), 0);
  assert.ok(Math.abs(summed - (score.riskScore + score.redemptionCredit)) < 1e-6);
});

test("fingerprint ignores noise but reacts to a real move", () => {
  const base = {
    tier: "watch" as const,
    riskScore: 7.0,
    totalCommits: 40,
    totalPushes: 10,
    topFiles: ["src/a.ts"],
  };

  assert.equal(
    factsFingerprint(base),
    factsFingerprint({ ...base, riskScore: 7.1 }),
    "a trivial score drift must not trigger a rewrite",
  );

  assert.notEqual(
    factsFingerprint(base),
    factsFingerprint({ ...base, tier: "probation" }),
    "a tier change must trigger a rewrite",
  );
});
