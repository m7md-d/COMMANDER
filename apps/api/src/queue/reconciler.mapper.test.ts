/**
 * The reconciler rebuilds pushes from REST commit data to recover what the
 * webhook missed during downtime. Two things must not regress: commits are
 * grouped by their real author (a shared push must never misattribute one
 * member's commits to another in the dossier), and the web-flow committer login
 * survives so the direct-push rule still fires on a recovered PR merge.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { GITHUB_UI_COMMITTER } from "@commander/shared";
import type { CommitListEntry } from "@/integrations/github/commits.client.js";
import { buildSyntheticPushes } from "@/queue/reconciler.mapper.js";

const REPO = { fullName: "team/repo" };

function entry(overrides: Partial<CommitListEntry> = {}): CommitListEntry {
  return {
    sha: "a".repeat(40),
    url: "https://github.com/team/repo/commit/a",
    title: "fix: correct the tax rounding",
    timestamp: "2026-07-01T12:00:00Z",
    authorLogin: "ahmad",
    committerLogin: "ahmad",
    ...overrides,
  };
}

test("commits are grouped into one push per author", () => {
  const pushes = buildSyntheticPushes(REPO, "main", [
    entry({ sha: "1", authorLogin: "ahmad" }),
    entry({ sha: "2", authorLogin: "sara" }),
    entry({ sha: "3", authorLogin: "ahmad" }),
  ]);

  assert.equal(pushes.length, 2);
  const ahmad = pushes.find((push) => push.actorLogin === "ahmad");
  assert.ok(ahmad);
  assert.deepEqual(ahmad.commits.map((commit) => commit.sha), ["1", "3"]);
  assert.equal(ahmad.branch, "main");
  assert.equal(ahmad.ref, "refs/heads/main");
});

test("a web-flow merge keeps its committer login and is attributed to the author", () => {
  const [push] = buildSyntheticPushes(REPO, "main", [
    entry({ sha: "m", authorLogin: "ahmad", committerLogin: GITHUB_UI_COMMITTER }),
  ]);

  assert.ok(push);
  // Grouped under the human author, not under web-flow...
  assert.equal(push.actorLogin, "ahmad");
  // ...but the committer login the direct-push rule reads is preserved.
  assert.equal(push.commits[0]?.committerLogin, GITHUB_UI_COMMITTER);
});

test("a commit with no author login falls back to committer, then unknown", () => {
  const pushes = buildSyntheticPushes(REPO, "dev", [
    entry({ sha: "1", authorLogin: "", committerLogin: "bot" }),
    entry({ sha: "2", authorLogin: "", committerLogin: "" }),
  ]);

  assert.deepEqual(pushes.map((push) => push.actorLogin).sort(), ["bot", "unknown"]);
});

test("commit order within a push is preserved, and file counts are unknown", () => {
  const [push] = buildSyntheticPushes(REPO, "main", [
    entry({ sha: "old" }),
    entry({ sha: "new" }),
  ]);

  assert.ok(push);
  assert.deepEqual(push.commits.map((commit) => commit.sha), ["old", "new"]);
  // The list endpoint carries no file data; enrichment backfills it later.
  assert.equal(push.commits[0]?.filesAdded, 0);
});
