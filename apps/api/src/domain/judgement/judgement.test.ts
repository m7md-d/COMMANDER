/**
 * The decision about a push, without the I/O around it. The scenario reference
 * plays these functions against real git; this pins what no scenario reaches —
 * the fronts that stay silent, or have nowhere to send — and who answers for
 * each finding, one rule at a time.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CHECKS, type NormalizedCommit, type NormalizedPush } from "@commander/shared";
import type { Reading } from "@/domain/checks/judge.js";
import { mergeWithDefaults, type RuleErrorReporter } from "@/domain/violations/engine.js";
import { admitPush, judgePush, type ChecksFacts, type PushFacts } from "./judgement.js";

const SARA = "sara";
const OMAR = "omar";

function commit(sha: string, overrides: Partial<NormalizedCommit> = {}): NormalizedCommit {
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
    ...overrides,
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
/**
 * Every engagement rule off — `weekend_ops` and `large_diff` ship off already.
 * `landed_unfixed` stays on: only a check's crossing on a main line raises it.
 */
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
/** Quiet, except for the shipped lazy-message rule: a charge on what a commit holds. */
const LAZY = mergeWithDefaults({ ...QUIET, lazy_message: { enabled: true } });
const DIRECT = mergeWithDefaults({ ...QUIET, direct_push: { enabled: true } });

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
    pull: { status: "unasked" },
    rules: QUIET,
    timezoneOffset: 3,
    watchers: [],
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

test("the pusher answers for what the push did, the author for what the commit holds", () => {
  // Omar pushed Sara's commit: the batch is his act, the crossing her work.
  const judgement = judge({ push: push([commit("c1")], { actorLogin: OMAR }), rules: ANY_NEW_WORK, checks: ledger(190, 210) });

  assert.deepEqual(
    judgement.violations.map((hit) => `${hit.ruleId}@${hit.login}`),
    ["batch_dump@omar", "file_lines@sara"],
  );
  assert.equal(judgement.pusher, OMAR);
  assert.equal(judgement.withheld, null);
});

test("a file brought back under its limit is credited to whoever's work did it", () => {
  const judgement = judge({ push: push([commit("c1")], { actorLogin: OMAR }), checks: ledger(210, 190) });

  assert.deepEqual(judgement.violations, []);
  assert.deepEqual(
    judgement.commendations.map((entry) => `${entry.ruleId}@${entry.login}`),
    ["file_lines@sara"],
  );
});

test("a commit is judged for what it holds once, when it first arrives", () => {
  const wip = commit("c1", { title: "wip" });

  assert.deepEqual(judge({ push: push([wip], { actorLogin: OMAR }), rules: LAZY }).violations.map((hit) => hit.login), [SARA]);
  assert.deepEqual(judge({ push: push([wip]), rules: LAZY, knownShas: new Set(["c1"]) }).violations, []);
});

test("work pushed elsewhere first is not this push's size, and is still judged for what it holds", () => {
  const elsewhere = commit("c1", { title: "wip", distinct: false });
  const judgement = judge({ push: push([elsewhere], { actorLogin: OMAR }), rules: mergeWithDefaults({ ...ANY_NEW_WORK, lazy_message: { enabled: true } }) });

  assert.deepEqual(judgement.violations.map((hit) => `${hit.ruleId}@${hit.login}`), ["lazy_message@sara"]);
});

test("each author answers for their own commits in a push that holds several", () => {
  const judgement = judge({
    push: push([commit("c1", { title: "wip" }), commit("c2", { title: "temp", authorLogin: "lina" })]),
    rules: LAZY,
  });

  assert.deepEqual(judgement.violations.map((hit) => hit.login).sort(), ["lina", SARA]);
});

test("a finding the evidence names nobody for is charged to nobody", () => {
  // An author address GitHub ties to no account; a recovered push, whose pusher git never recorded.
  const unlinked = judge({ push: push([commit("c1", { title: "wip", authorLogin: "" })]), rules: LAZY });
  const recovered = judge({ push: push([commit("c1")], { recovered: true, defaultBranch: "main" }), rules: DIRECT });

  for (const judgement of [unlinked, recovered]) assert.deepEqual(judgement.violations, []);
  assert.deepEqual(unlinked.unattributed.map((entry) => entry.ruleId), ["lazy_message"]);
  assert.deepEqual(recovered.unattributed.map((entry) => entry.ruleId), ["direct_push"]);
  assert.equal(recovered.pusher, null);
});

test("a file two people changed in one push is charged to neither", () => {
  const judgement = judge({ push: push([commit("c1"), commit("c2", { authorLogin: "lina" })]), checks: ledger(190, 210) });

  assert.deepEqual(judgement.violations, [], "which of them crossed it would take a measurement per commit");
  assert.deepEqual(judgement.unattributed.map((entry) => entry.ruleId), ["file_lines"]);
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

const charges = (overrides: Partial<PushFacts>) =>
  judge(overrides).violations.map((hit) => `${hit.ruleId}@${hit.login}`).sort();
/** Omar lands Sara's commit c1 on main. */
const LANDED = push([commit("c1")], { actorLogin: OMAR, defaultBranch: "main" });

test("someone else's crossing landed on a main line: its author wrote it, the pusher landed it", () => {
  assert.deepEqual(charges({ push: LANDED, checks: ledger(190, 210) }), ["file_lines@sara", "landed_unfixed@omar"]);
});

test("a crossing reported on its branch and merged unfixed is the merger's alone", () => {
  // Sara was charged when c1 arrived; landing it again charges whoever landed it.
  assert.deepEqual(charges({ push: LANDED, knownShas: new Set(["c1"]), checks: ledger(190, 210) }), ["landed_unfixed@omar"]);
});

test("off a main line nothing is landed: pulling main into a feature charges nobody for main", () => {
  const synced = push([commit("c1")], { actorLogin: OMAR, defaultBranch: "main", branch: "feature/x", ref: "refs/heads/feature/x" });

  assert.deepEqual(charges({ push: synced, knownShas: new Set(["c1"]), checks: ledger(190, 210) }), []);
  // A branch a watcher guards is a main line too.
  const guarded = [{ pattern: "feature/*", gravity: "guarded" as const, promptId: null, model: "" }];
  assert.deepEqual(charges({ push: synced, knownShas: new Set(["c1"]), checks: ledger(190, 210), watchers: guarded }), [
    "landed_unfixed@omar",
  ]);
});

test("a pusher's own crossing is charged once, as its author", () => {
  assert.deepEqual(charges({ push: push([commit("c1")], { defaultBranch: "main" }), checks: ledger(190, 210) }), ["file_lines@sara"]);
});

test("a push that cannot be weighed lands nothing: its own work cannot be told from others'", () => {
  const unweighed = push([{ ...commit("c1"), paths: undefined }], { actorLogin: OMAR, defaultBranch: "main" });

  assert.deepEqual(charges({ push: unweighed, checks: ledger(190, 210) }), []);
});

test("the rules about landing work hold on a main line only; what a commit holds, on every branch", () => {
  const rules = mergeWithDefaults({ ...QUIET, direct_push: { enabled: true }, lazy_message: { enabled: true } });
  const wip = [commit("c1", { title: "wip" })];
  const onFeature = judge({ push: push(wip, { defaultBranch: "main", branch: "feature/x", ref: "refs/heads/feature/x" }), rules });
  const onMain = judge({ push: push(wip, { defaultBranch: "main" }), rules });

  assert.deepEqual(onFeature.violations.map((hit) => hit.ruleId), ["lazy_message"], "pushing to your own branch is how a pull request is opened");
  assert.deepEqual(onMain.violations.map((hit) => hit.ruleId).sort(), ["direct_push", "lazy_message"]);
  assert.deepEqual([onFeature.mainLine, onMain.mainLine], [false, true], "kept with every charge, which weighs double on a main line");
});

test("a silent front withholds a push that found nothing — withholding is about sending, never recording", () => {
  const judgement = judge({ silentWhenClean: true });

  assert.equal(judgement.withheld, "clean_and_silent");
  // No flag says whether to record: every judged push is, so the record has no
  // holes and the reconciler does not recover a silent push again every pass
  // (0009 §5). It was once tied to sending, and a front with no channel lost its
  // charges with it (lazy-commit-on-a-front-with-no-channel).
  assert.equal("recorded" in judgement, false);
});

test("a commendation alone breaks the silence", () => {
  assert.equal(judge({ silentWhenClean: true, checks: ledger(210, 190) }).withheld, null);
});

test("with nowhere to send, a push is withheld — its charges stand, and silence is the reason given first", () => {
  const unsent = judge({ hasChannel: false, rules: ANY_NEW_WORK });

  assert.equal(unsent.withheld, "discord_missing");
  assert.notDeepEqual(unsent.violations, [], "what is found is recorded whether or not it is sent");
  assert.equal(judge({ hasChannel: false, silentWhenClean: true }).withheld, "clean_and_silent");
});

test("the judgement names the commits the push brought, and leaves what it carried out (0009 §7)", () => {
  const judgement = judge({ push: push([commit("c1"), commit("c2")]), knownShas: new Set(["c1"]) });

  assert.deepEqual(judgement.fresh, ["c2"]);
});
