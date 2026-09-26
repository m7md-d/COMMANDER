/**
 * The decision about a push, without the I/O around it. The scenario reference
 * plays these functions against real git; this pins what no scenario reaches —
 * the fronts that stay silent, or have nowhere to send.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CHECKS, type NormalizedCommit, type NormalizedPush } from "@commander/shared";
import type { Reading } from "@/domain/checks/judge.js";
import { mergeWithDefaults, type RuleErrorReporter } from "@/domain/violations/engine.js";
import { admitPush, judgePush, type ChecksFacts, type PushFacts } from "./judgement.js";

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

const lines = (count: number): Reading => ({
  lines: count,
  functionLines: null,
  nestingDepth: null,
  braceDepth: null,
  longestLine: null,
});

/** The push took `src/ledger.ts` from `before` lines to `after` — the path commit c1 touched. */
function ledger(before: number, after: number): ChecksFacts {
  const [from, to] = [`ledger@${before}`, `ledger@${after}`];
  return {
    config: DEFAULT_CHECKS,
    changes: [{ path: "src/ledger.ts", sha: to, previousSha: from }],
    readings: new Map([
      [from, lines(before)],
      [to, lines(after)],
    ]),
  };
}

const NO_CHANGES: ChecksFacts = { config: DEFAULT_CHECKS, changes: [], readings: new Map() };

const failOnRuleError: RuleErrorReporter = (ruleId) => {
  throw new Error(`rule ${ruleId} threw`);
};

function facts(overrides: Partial<PushFacts> = {}): PushFacts {
  return {
    push: push([commit("c1")]),
    knownShas: new Set(),
    rules: QUIET,
    timezoneOffset: 3,
    checks: NO_CHANGES,
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
  const judgement = judge({ rules: ANY_NEW_WORK, checks: ledger(190, 210) });

  assert.deepEqual(
    judgement.violations.map((hit) => hit.ruleId),
    ["batch_dump", "file_lines"],
  );
  assert.equal(judgement.login, SARA);
  assert.deepEqual([judgement.recorded, judgement.withheld], [true, null]);
});

test("a file brought back under its limit is credited, not charged", () => {
  const judgement = judge({ checks: ledger(210, 190) });

  assert.deepEqual(judgement.violations, []);
  assert.deepEqual(
    judgement.commendations.map((entry) => entry.ruleId),
    ["file_lines"],
  );
});

test("work already on record weighs nothing, and its crossings are not judged again", () => {
  const judgement = judge({ rules: ANY_NEW_WORK, knownShas: new Set(["c1"]), checks: ledger(190, 210) });

  assert.deepEqual(judgement.violations, [], "c1 was judged when it arrived — here it is only carried");
});

test("a change new work did not touch is not judged", () => {
  const elsewhere: ChecksFacts = {
    ...ledger(190, 210),
    changes: [{ path: "src/report.ts", sha: "ledger@210", previousSha: "ledger@190" }],
  };

  assert.deepEqual(judge({ checks: elsewhere }).violations, [], "no commit of this push touched src/report.ts");
});

test("a push that cannot be weighed has nothing judged by the checks", () => {
  const unweighed = push([{ ...commit("c1"), paths: undefined }]);

  assert.deepEqual(judge({ push: unweighed, checks: ledger(190, 210) }).violations, []);
});

test("a silent front withholds a push that found nothing, and records none of it", () => {
  const judgement = judge({ silentWhenClean: true });

  assert.deepEqual([judgement.recorded, judgement.withheld], [false, "clean_and_silent"]);
});

test("a commendation alone breaks the silence", () => {
  const judgement = judge({ silentWhenClean: true, checks: ledger(210, 190) });

  assert.deepEqual([judgement.recorded, judgement.withheld], [true, null]);
});

test("with nowhere to send, a push is withheld — and silence is the reason given first", () => {
  assert.equal(judge({ hasChannel: false }).withheld, "discord_missing");
  assert.equal(judge({ hasChannel: false, silentWhenClean: true }).withheld, "clean_and_silent");
});
