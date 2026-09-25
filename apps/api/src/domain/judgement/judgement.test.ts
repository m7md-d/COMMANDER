/**
 * The decision about a push, without the I/O around it. The scenario reference
 * plays these functions against real git; this pins what no scenario reaches —
 * the fronts that stay silent, or have nowhere to send.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Commendation, NormalizedCommit, NormalizedPush, ViolationHit } from "@commander/shared";
import { mergeWithDefaults, type RuleErrorReporter } from "@/domain/violations/engine.js";
import { admitPush, judgePush, type PushFacts } from "./judgement.js";

const SARA = "sara";

function commit(sha: string): NormalizedCommit {
  return {
    sha,
    title: "Record the ledger totals by month",
    url: "",
    timestamp: "2026-08-10T10:00:00+03:00",
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 1,
    authorLogin: SARA,
    committerLogin: SARA,
    parents: ["p0"],
    paths: ["src/ledger.ts"],
  };
}

function push(commits: NormalizedCommit[], overrides: Partial<NormalizedPush> = {}): NormalizedPush {
  return {
    repoFullName: "team/repo",
    repoUrl: "",
    branch: "main",
    ref: "refs/heads/main",
    forced: false,
    created: false,
    deleted: false,
    compareUrl: "",
    actorLogin: SARA,
    actorAvatarUrl: "",
    commits,
    truncated: false,
    ...overrides,
  };
}

const OFF = { enabled: false };
/** Every rule off — `weekend_ops` and `large_diff` ship off already. */
const QUIET = mergeWithDefaults({
  force_push: OFF,
  batch_dump: OFF,
  direct_push: OFF,
  lazy_message: OFF,
  night_ops: OFF,
  branch_deleted: OFF,
  merge_residue: OFF,
});
/** Quiet, except that any new commit at all is a batch: a charge exactly when new work arrives. */
const ANY_NEW_WORK = mergeWithDefaults({ ...QUIET, batch_dump: { enabled: true, threshold: 0 } });

const CROSSING: ViolationHit = { ruleId: "file_lines", detail: { before: 190, after: 210, limit: 200 } };
const IMPROVED: Commendation = { ruleId: "file_lines", detail: { before: 210, after: 190, limit: 200 } };

const failOnRuleError: RuleErrorReporter = (ruleId) => {
  throw new Error(`rule ${ruleId} threw`);
};

function facts(overrides: Partial<PushFacts> = {}): PushFacts {
  return {
    push: push([commit("c1")]),
    knownShas: new Set(),
    rules: QUIET,
    timezoneOffset: 3,
    checks: { violations: [], commendations: [] },
    silentWhenClean: false,
    hasChannel: true,
    ...overrides,
  };
}

const judge = (overrides: Partial<PushFacts>) => judgePush(facts(overrides), failOnRuleError);

test("a disabled front and an unwatched branch are not read at all", () => {
  const onFeature = push([commit("c1")], { branch: "feature/x", ref: "refs/heads/feature/x" });

  assert.deepEqual(admitPush({ repository: { enabled: false, branches: [] }, push: onFeature }), {
    read: false,
    reason: "repo_disabled",
  });
  assert.deepEqual(admitPush({ repository: { enabled: true, branches: ["main"] }, push: onFeature }), {
    read: false,
    reason: "branch_not_watched",
  });
});

test("a push with no commits is read but not judged, unless it deletes the branch", () => {
  const front = { enabled: true, branches: [] };

  assert.deepEqual(admitPush({ repository: front, push: push([]) }), { read: true, judged: false, reason: "no_commits" });
  assert.deepEqual(admitPush({ repository: front, push: push([], { deleted: true }) }), { read: true, judged: true });
  assert.deepEqual(admitPush({ repository: front, push: push([commit("c1")]) }), { read: true, judged: true });
});

test("the rules' charges come before the checks', and one login answers for all of them", () => {
  const judgement = judge({ rules: ANY_NEW_WORK, checks: { violations: [CROSSING], commendations: [IMPROVED] } });

  assert.deepEqual(
    judgement.violations.map((hit) => hit.ruleId),
    ["batch_dump", "file_lines"],
  );
  assert.deepEqual(judgement.commendations, [IMPROVED]);
  assert.equal(judgement.login, SARA);
  assert.deepEqual([judgement.recorded, judgement.withheld], [true, null]);
});

test("work already on record weighs nothing", () => {
  assert.deepEqual(judge({ rules: ANY_NEW_WORK, knownShas: new Set(["c1"]) }).violations, []);
});

test("a silent front withholds a push that found nothing, and records none of it", () => {
  const judgement = judge({ silentWhenClean: true });

  assert.deepEqual([judgement.recorded, judgement.withheld], [false, "clean_and_silent"]);
});

test("a commendation alone breaks the silence", () => {
  const judgement = judge({ silentWhenClean: true, checks: { violations: [], commendations: [IMPROVED] } });

  assert.deepEqual([judgement.recorded, judgement.withheld], [true, null]);
});

test("with nowhere to send, a push is withheld — and silence is the reason given first", () => {
  assert.equal(judge({ hasChannel: false }).withheld, "discord_missing");
  assert.equal(judge({ hasChannel: false, silentWhenClean: true }).withheld, "clean_and_silent");
});
