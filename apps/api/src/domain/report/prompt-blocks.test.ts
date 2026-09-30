/**
 * What the model is handed of a push's commits (0009 §7, D-38): the work it
 * brought, and what it only carried as a count — never the raw list, which let
 * a pull request's landing read as a heap pushed at once.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedCommit, NormalizedPush } from "@commander/shared";
import { buildCommitBlock, freshCommits } from "./prompt-blocks.js";

const QUOTE = { maxLength: 120, guardEnabled: true };

function commit(sha: string, title: string): NormalizedCommit {
  return { sha, title, url: "", timestamp: "", filesAdded: 0, filesRemoved: 0, filesModified: 1, authorLogin: "sara", committerLogin: "sara" };
}

function push(commits: NormalizedCommit[]): NormalizedPush {
  return { repoFullName: "team/repo", repoUrl: "", branch: "main", ref: "refs/heads/main", forced: false, created: false, deleted: false, compareUrl: "", actorLogin: "omar", actorAvatarUrl: "", commits, truncated: false };
}

const LANDING = push([...Array.from({ length: 19 }, (_, at) => commit(`c${at}`, `step ${at}`)), commit("m", "Merge pull request #12")]);

test("the commits the push brought are listed, and what it carried is a count", () => {
  const block = buildCommitBlock({ push: LANDING, fresh: ["m"] }, "ar", QUOTE);

  assert.match(block, /Merge pull request #12/);
  assert.doesNotMatch(block, /step 3/);
  assert.match(block, /19/, "what was carried is still said");
});

test("freshCommits: the new work — or every commit, for a report kept before it was", () => {
  assert.deepEqual(freshCommits({ push: LANDING, fresh: ["m"] }).map((entry) => entry.sha), ["m"]);
  assert.equal(freshCommits({ push: LANDING, fresh: null }).length, 20);
});
