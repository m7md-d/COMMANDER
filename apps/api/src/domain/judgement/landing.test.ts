/**
 * A landing merge judged against its own parents. The scenario reference plays
 * these against real merges; this pins each part on its own — which pushes are
 * landings, and whose each share of a crossing is.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CHECKS, weighPush, type NormalizedCommit, type NormalizedPush } from "@commander/shared";
import type { Reading } from "@/domain/checks/judge.js";
import { judgeLanding, landingMerge, type LandingSides } from "./landing.js";

const LEDGER = "src/ledger.ts";

function commit(sha: string, overrides: Partial<NormalizedCommit> = {}): NormalizedCommit {
  return {
    sha,
    title: "Track refunds in the ledger",
    url: "",
    timestamp: "2026-08-10T10:00:00+03:00",
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 1,
    authorLogin: "sara",
    committerLogin: "sara",
    parents: ["F"],
    paths: [LEDGER],
    ...overrides,
  };
}

/** Sara's commit S on her branch, and Omar's merge M of it onto main's P. */
const MERGE = commit("M", { authorLogin: "omar", committerLogin: "omar", parents: ["P", "S"] });

function push(commits: NormalizedCommit[] = [commit("S"), MERGE]): NormalizedPush {
  return {
    repoFullName: "team/repo",
    repoUrl: "",
    branch: "main",
    ref: "refs/heads/main",
    forced: false,
    created: false,
    deleted: false,
    compareUrl: "",
    before: "P",
    after: "M",
    actorLogin: "omar",
    actorAvatarUrl: "",
    commits,
    truncated: false,
  };
}

const NONE: ReadonlySet<string> = new Set();

test("landingMerge: a merge onto the branch's previous head, bringing plain commits", () => {
  assert.deepEqual(landingMerge({ push: push(), knownShas: NONE }), { merge: "M", first: "P", second: "S" });

  const noMerge = push([commit("S")]);
  const elsewhere = push([commit("S"), { ...MERGE, parents: ["X", "S"] }]);
  const octopus = push([commit("S"), { ...MERGE, parents: ["P", "S", "T"] }]);
  const tangled = push([commit("S", { parents: ["F", "G"] }), MERGE]);
  const unenriched = push([commit("S", { parents: undefined }), MERGE]);
  for (const shape of [noMerge, elsewhere, octopus, tangled, unenriched]) {
    assert.equal(landingMerge({ push: shape, knownShas: NONE }), null);
  }
});

test("landingMerge: GitHub's button on a branch already on record has nothing to read", () => {
  const button = push([commit("S"), { ...MERGE, committerLogin: "web-flow" }]);

  assert.equal(landingMerge({ push: button, knownShas: new Set(["S"]) }), null, "it merges only what merges cleanly");
  assert.ok(landingMerge({ push: button, knownShas: NONE }), "new branch work is judged from its fork");
});

const lines = (count: number): Reading => ({ lines: count, functionLines: null, nestingDepth: null, braceDepth: null, longestLine: null });
/** The ledger's blob at a size: `L190` holds 190 lines. */
const at = (count: number) => `L${count}`;

/** A landing of the ledger: at the fork, on main (first), on the branch (second), and in the merge. */
function landing(v: { fork: number; first: number; second: number; merged: number }, knownShas: ReadonlySet<string> = NONE) {
  const sides: LandingSides = {
    merge: "M",
    branch: v.second === v.fork ? [] : [{ path: LEDGER, sha: at(v.second), previousSha: at(v.fork) }],
    first: new Map([[LEDGER, at(v.first)]]),
    fork: new Map([[LEDGER, at(v.fork)]]),
    second: new Map([[LEDGER, at(v.second)]]),
    merged: new Map([[LEDGER, at(v.merged)]]),
  };
  const net = v.merged === v.first ? [] : [{ path: LEDGER, sha: at(v.merged), previousSha: at(v.first) }];
  const readings = new Map([v.fork, v.first, v.second, v.merged].map((count) => [at(count), lines(count)]));
  const pushed = push();
  const scope = { push: pushed, weight: weighPush({ push: pushed, knownShas }), knownShas, config: DEFAULT_CHECKS, readings, pusher: "omar", trunk: true };

  const outcome = judgeLanding(net, sides, scope);
  const named = (entries: { ruleId: string; login: string | null }[]) => entries.map((entry) => `${entry.ruleId}@${entry.login}`);
  return { charges: named(outcome.violations), credits: named(outcome.commendations), landed: outcome.landed.length };
}

test("judgeLanding: two edits under the limit, joined over it, are no author's crossing — only a landing", () => {
  // Sara 150 → 170 on her branch, main 150 → 190 meanwhile, the merge 210.
  assert.deepEqual(landing({ fork: 150, first: 190, second: 170, merged: 210 }), { charges: [], credits: [], landed: 1 });
});

test("judgeLanding: the branch's own crossing is its author's, from where it forked", () => {
  assert.deepEqual(landing({ fork: 190, first: 190, second: 210, merged: 210 }), { charges: ["file_lines@sara"], credits: [], landed: 1 });
  // Already on record: judged when it arrived, and still landed by the merger.
  assert.deepEqual(landing({ fork: 190, first: 190, second: 210, merged: 210 }, new Set(["S"])), { charges: [], credits: [], landed: 1 });
});

test("judgeLanding: what the merge writes itself is its author's, a fix or a crossing", () => {
  // The branch left 210; the merger trimmed it to 195 while merging.
  assert.deepEqual(landing({ fork: 190, first: 190, second: 210, merged: 195 }, new Set(["S"])), { charges: [], credits: ["file_lines@omar"], landed: 0 });
  // The branch left 195; the merge wrote 212 — the merger's own, so not landed as someone else's.
  assert.deepEqual(landing({ fork: 190, first: 190, second: 195, merged: 212 }), { charges: ["file_lines@omar"], credits: [], landed: 0 });
});
