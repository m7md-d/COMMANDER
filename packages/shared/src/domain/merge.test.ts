import assert from "node:assert/strict";
import { test } from "node:test";
import { isMerge, weighPush } from "./merge.js";
import type { NormalizedCommit, NormalizedPush } from "./push.js";

function commit(sha: string, paths: string[], parents: string[] = ["p0"]): NormalizedCommit {
  return {
    sha,
    title: `work ${sha}`,
    url: "",
    timestamp: "2026-08-03T10:00:00Z",
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: paths.length,
    authorLogin: "ahmad",
    committerLogin: "ahmad",
    parents,
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
    actorLogin: "ahmad",
    actorAvatarUrl: "",
    commits,
    truncated: false,
    ...overrides,
  };
}

const NONE: ReadonlySet<string> = new Set();

/** The paths each commit did on its own, by sha. */
const workOf = (weight: ReturnType<typeof weighPush>) =>
  Object.fromEntries(weight.work.map((entry) => [entry.sha, [...entry.paths].sort()]));

test("a merge is two parents, not a title", () => {
  assert.equal(isMerge(commit("a", [], ["p0", "p1"])), true);
  assert.equal(isMerge(commit("b", [], ["p0"])), false);
  // The title convention is what squash and rebase merges do not have, and what
  // any ordinary commit can imitate.
  assert.equal(isMerge({ ...commit("c", [], ["p0"]), title: "Merge branch 'main'" }), false);
});

test("a clean merge weighs nothing: it transports work, it does not add it", () => {
  const one = commit("c1", ["src/a.ts"]);
  const two = commit("c2", ["src/b.ts"]);
  const merge = commit("m", ["src/a.ts", "src/b.ts"], ["p0", "c2"]);

  const weight = weighPush({ push: push([one, two, merge]), knownShas: NONE });

  assert.equal(weight.measured, true);
  assert.deepEqual(workOf(weight)["m"], [], "nothing in the merge that its commits do not have");
  assert.equal(weight.filesTouched, 2, "the two files, once — not four");
});

test("work already recorded is not charged again when a merge re-delivers it", () => {
  const one = commit("c1", ["src/a.ts"]);
  const two = commit("c2", ["src/b.ts"]);
  const merge = commit("m", ["src/a.ts", "src/b.ts"], ["p0", "c2"]);

  const weight = weighPush({
    push: push([one, two, merge]),
    knownShas: new Set(["c1", "c2"]), // both reported when the branch was pushed
  });

  assert.equal(weight.newCommits, 1, "only the merge commit is new");
  assert.equal(weight.filesTouched, 0, "and it introduced nothing of its own");
});

test("a merge carrying a path no commit of its own touched is the smuggled line", () => {
  const one = commit("c1", ["src/a.ts"]);
  const two = commit("c2", ["src/b.ts"]);
  const merge = commit("m", ["src/a.ts", "src/b.ts", "src/auth.ts"], ["p0", "c2"]);

  const weight = weighPush({ push: push([one, two, merge]), knownShas: new Set(["c1", "c2"]) });

  assert.deepEqual(workOf(weight), { m: ["src/auth.ts"] });
  assert.equal(weight.filesTouched, 1, "charged for what it added, not for what it carried");
});

test("each unjudged commit's own work: a commit's every path, a merge's residue alone", () => {
  const known = commit("c1", ["src/a.ts"]);
  const fresh = commit("c2", ["src/b.ts", "src/c.ts"]);
  const merge = commit("m", ["src/a.ts", "src/b.ts", "src/c.ts", "src/auth.ts"], ["p0", "c2"]);

  const weight = weighPush({ push: push([known, fresh, merge]), knownShas: new Set(["c1"]) });

  assert.deepEqual(workOf(weight), { c2: ["src/b.ts", "src/c.ts"], m: ["src/auth.ts"] });
  assert.ok(!("c1" in workOf(weight)), "a recorded commit was judged when it arrived");
});

test("work pushed elsewhere first is not this push's size, and is still judged once", () => {
  // Sara's branch was pushed where this front does not look; Omar's merge lands it.
  const one = { ...commit("c1", ["src/a.ts"]), distinct: false };
  const two = { ...commit("c2", ["src/b.ts"]), distinct: false };
  const merge = { ...commit("m", ["src/a.ts", "src/b.ts"], ["p0", "c2"]), distinct: true };

  const weight = weighPush({ push: push([one, two, merge]), knownShas: NONE });

  assert.equal(weight.newCommits, 1, "only the merge was new to the repository");
  assert.equal(weight.filesTouched, 0, "and it carried the branch rather than adding to it");
  assert.deepEqual(workOf(weight), { c1: ["src/a.ts"], c2: ["src/b.ts"], m: [] }, "never on record, so judged now");
});

test("without GitHub's word on it — a recovered push — the record alone decides what is new", () => {
  const weight = weighPush({ push: push([commit("c1", ["src/a.ts"]), commit("c2", ["src/b.ts"])]), knownShas: new Set(["c1"]) });

  assert.equal(weight.newCommits, 1);
  assert.deepEqual(Object.keys(workOf(weight)), ["c2"]);
});

test("a truncated push is not weighed: the constituents it dropped are invisible", () => {
  const merge = commit("m", ["src/a.ts", "src/b.ts"], ["p0", "c2"]);

  const weight = weighPush({ push: push([merge], { truncated: true }), knownShas: NONE });

  assert.equal(weight.measured, false);
  assert.deepEqual(weight.work, [], "silence, not an accusation built on a partial payload");
});

test("a merge whose branch head is absent is not weighed", () => {
  // Without c2 in the push, every path the merge carries would read as its own.
  const merge = commit("m", ["src/a.ts", "src/b.ts"], ["p0", "c2"]);

  const weight = weighPush({ push: push([merge]), knownShas: NONE });

  assert.equal(weight.measured, false);
  assert.deepEqual(weight.work, []);
});

test("an unenriched push falls back to the old count rather than guessing", () => {
  // No App, or a failed detail call: no paths, so no residue can be honest.
  const bare: NormalizedCommit = { ...commit("c1", ["src/a.ts"]), paths: undefined };

  const weight = weighPush({ push: push([bare]), knownShas: NONE });

  assert.equal(weight.measured, false);
  assert.equal(weight.filesTouched, 1, "the pre-existing count, unchanged");
});

test("an ordinary push is unaffected by any of this", () => {
  const one = commit("c1", ["src/a.ts", "src/b.ts"]);
  const two = commit("c2", ["src/c.ts"]);

  const weight = weighPush({ push: push([one, two]), knownShas: NONE });

  assert.equal(weight.measured, true);
  assert.equal(weight.newCommits, 2);
  assert.equal(weight.filesTouched, 3);
  assert.deepEqual(workOf(weight), { c1: ["src/a.ts", "src/b.ts"], c2: ["src/c.ts"] });
});
