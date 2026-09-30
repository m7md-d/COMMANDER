/**
 * What a push's code review reads (0009 §7, D-39): the event's net diff, once,
 * and only the work it brought — never a merge reviewed as a giant commit in
 * the name of whoever merged it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedCommit, NormalizedPush } from "@commander/shared";
import { reviewTarget } from "./target.js";

function commit(sha: string, author: string, parents = ["p"]): NormalizedCommit {
  return { sha, title: `work ${sha}`, url: "", timestamp: "", filesAdded: 0, filesRemoved: 0, filesModified: 1, authorLogin: author, committerLogin: author, parents };
}

function push(commits: NormalizedCommit[]): NormalizedPush {
  return { repoFullName: "team/repo", repoUrl: "", branch: "main", ref: "refs/heads/main", forced: false, created: false, deleted: false, compareUrl: "", before: "b0", after: commits.at(-1)?.sha ?? "", actorLogin: "omar", actorAvatarUrl: "", commits, truncated: false };
}

test("a push is reviewed once, on its net diff, and filed under the one author of its new work", () => {
  const target = reviewTarget({ push: push([commit("c1", "sara"), commit("c2", "sara")]), fresh: ["c1", "c2"] });

  assert.deepEqual(target, { base: "b0", head: "c2", login: "sara", authors: ["sara"], title: "work c2" });
});

test("work by several authors is reviewed, and filed under nobody", () => {
  assert.equal(reviewTarget({ push: push([commit("c1", "sara"), commit("c2", "lina")]), fresh: ["c1", "c2"] })?.login, null);
});

test("a landing that brings nothing new but its merge is not reviewed at all", () => {
  const landing = push([commit("c1", "sara"), commit("m", "omar", ["b0", "c1"])]);

  assert.equal(reviewTarget({ push: landing, fresh: ["m"] }), null, "the branch was reviewed when it was pushed");
  assert.equal(reviewTarget({ push: landing, fresh: ["c1", "m"] })?.login, "sara", "new branch work is its author's, not the merger's");
});
