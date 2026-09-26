/**
 * Who answers for a finding, piece by piece. `judgement.test.ts` pins the same
 * decisions through `judgePush`; these pin the parts it is assembled from, and
 * the two the processor calls on its own to file what a push leaves behind.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { weighPush, type NormalizedCommit, type NormalizedPush } from "@commander/shared";
import { mergeWithDefaults } from "@/domain/violations/engine.js";
import { answered, filedUnder, handsOnPaths, judgeRules, newCommitsBy, pusherOf, soleHand } from "./attribution.js";

function commit(sha: string, authorLogin: string, paths: string[] = ["src/a.ts"]): NormalizedCommit {
  return {
    sha,
    title: "wip",
    url: "",
    timestamp: "2026-08-10T10:00:00+03:00",
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: paths.length,
    authorLogin,
    committerLogin: authorLogin,
    parents: ["p0"],
    paths,
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
    actorLogin: "omar",
    actorAvatarUrl: "",
    commits,
    truncated: false,
    ...overrides,
  };
}

const NONE: ReadonlySet<string> = new Set();

test("pusherOf: whoever pushed — and nobody, for a push git never recorded the pusher of", () => {
  assert.equal(pusherOf(push([])), "omar");
  assert.equal(pusherOf(push([], { recovered: true })), null);
});

test("judgeRules: the pusher's rules name the pusher, each author's rules that author", () => {
  const off = { enabled: false };
  const rules = mergeWithDefaults({ force_push: { enabled: true }, direct_push: off, batch_dump: off, night_ops: off, merge_residue: off, branch_deleted: off });
  const forced = push([commit("c1", "sara"), commit("c2", "lina")], { forced: true });

  const weight = weighPush({ push: forced, knownShas: NONE });
  const named = judgeRules({ push: forced, kind: "rewrite", trunk: true, weight, knownShas: NONE, rules, timezoneOffset: 3, landed: [] }, () => {
    throw new Error("no rule should throw");
  });

  assert.deepEqual(
    named.map((entry) => `${entry.ruleId}@${entry.login}`).sort(),
    ["force_push@omar", "lazy_message@lina", "lazy_message@sara"],
  );
});

test("handsOnPaths and soleHand: every author who changed a path, and the one a crossing can name", () => {
  const both = push([commit("c1", "sara", ["src/a.ts", "src/b.ts"]), commit("c2", "lina", ["src/b.ts"])]);
  const hands = handsOnPaths(both, weighPush({ push: both, knownShas: new Set(["c0"]) }));

  assert.deepEqual(Object.fromEntries([...hands].map(([path, who]) => [path, [...who].sort()])), {
    "src/a.ts": ["sara"],
    "src/b.ts": ["lina", "sara"],
  });
  assert.equal(soleHand(hands.get("src/a.ts") ?? new Set()), "sara");
  assert.equal(soleHand(hands.get("src/b.ts") ?? new Set()), null, "two hands name nobody");
});

test("answered: a finding that names nobody is not written down", () => {
  const found = [
    { ruleId: "lazy_message" as const, detail: {}, login: "sara" },
    { ruleId: "lazy_message" as const, detail: {}, login: null },
  ];

  assert.deepEqual(answered(found), [{ ruleId: "lazy_message", detail: {}, login: "sara" }]);
});

test("filedUnder and newCommitsBy: a commit is its author's, and counted once", () => {
  const delivered = push([commit("c1", "sara"), commit("c2", ""), commit("c3", "sara")]);

  assert.equal(filedUnder(delivered.commits[0] ?? commit("x", ""), delivered), "sara");
  assert.equal(filedUnder(delivered.commits[1] ?? commit("x", ""), delivered), "omar", "authorless: filed under whoever delivered it");
  assert.deepEqual(Object.fromEntries(newCommitsBy(delivered, new Set(["c3"]))), { sara: 1, omar: 1 });
});
