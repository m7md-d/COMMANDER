/**
 * The direct-push rule is the one most easily broken by a "simplification":
 * matching a `Merge ...` message prefix looks equivalent and is not. Squash and
 * rebase merges produce ordinary commit titles, so the naive version flags an
 * entire team's normal pull-request workflow as a bypass.
 *
 * These tests exist to make that regression fail loudly rather than quietly
 * turn every report into noise.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedCommit, NormalizedPush, RuleConfigBase } from "@commander/shared";
import { GITHUB_UI_COMMITTER } from "@commander/shared";
import { directPushRule } from "@/domain/violations/rules/direct-push.rule.js";
import { normalizePush } from "@/modules/webhook/push.mapper.js";

const ENABLED: RuleConfigBase = { enabled: true };

function commit(overrides: Partial<NormalizedCommit> = {}): NormalizedCommit {
  return {
    sha: "a".repeat(40),
    title: "fix: correct the tax rounding",
    url: "https://github.com/team/repo/commit/a",
    timestamp: "2026-07-01T12:00:00Z",
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 1,
    authorLogin: "ahmad-gh",
    committerLogin: "ahmad-gh",
    ...overrides,
  };
}

function push(commits: NormalizedCommit[]): NormalizedPush {
  return {
    repoFullName: "team/repo",
    repoUrl: "https://github.com/team/repo",
    branch: "main",
    ref: "refs/heads/main",
    forced: false,
    created: false,
    deleted: false,
    compareUrl: "",
    actorLogin: "ahmad-gh",
    actorAvatarUrl: "",
    commits,
    truncated: false,
  };
}

const evaluate = (commits: NormalizedCommit[]) =>
  directPushRule({ push: push(commits), timezoneOffset: 3 }, ENABLED);

test("local commits pushed straight to the branch are flagged", () => {
  const hit = evaluate([commit(), commit({ sha: "b".repeat(40) })]);
  assert.deepEqual(hit, { count: 2 });
});

test("a squash merge is NOT a direct push, despite its ordinary title", () => {
  // This is the trap: the title carries no "Merge" prefix, only the committer
  // identity betrays that GitHub produced it.
  const squashed = commit({
    title: "Add invoice export (#42)",
    committerLogin: GITHUB_UI_COMMITTER,
  });

  assert.equal(evaluate([squashed]), null);
});

test("a rebase merge is NOT a direct push either", () => {
  const rebased = commit({ title: "chore: bump deps", committerLogin: GITHUB_UI_COMMITTER });
  assert.equal(evaluate([rebased]), null);
});

test("the classic merge commit is still recognised by its title", () => {
  // Kept as a second signal: a merge made locally and pushed carries the
  // developer as committer, so identity alone would miss it.
  const merged = commit({ title: "Merge pull request #7 from team/feature" });
  assert.equal(evaluate([merged]), null);
});

test("one GitHub-produced commit clears the whole push", () => {
  const hit = evaluate([commit(), commit({ committerLogin: GITHUB_UI_COMMITTER })]);
  assert.equal(hit, null);
});

test("a push with no commits — a branch delete or a tag — never fires", () => {
  assert.equal(evaluate([]), null);
});

test("normalizePush preserves the committer login the rule depends on", () => {
  // Guards the seam: a field rename in the mapper would silently disarm the
  // rule above, and every test here would still pass on its own.
  const normalized = normalizePush({
    ref: "refs/heads/main",
    repository: { full_name: "team/repo" },
    commits: [
      {
        id: "c".repeat(40),
        message: "Add invoice export (#42)\n\nlonger body",
        committer: { username: GITHUB_UI_COMMITTER },
        author: { username: "ahmad-gh" },
      },
    ],
  });

  assert.equal(normalized.commits[0]?.committerLogin, GITHUB_UI_COMMITTER);
  assert.equal(normalized.commits[0]?.title, "Add invoice export (#42)");
  assert.equal(directPushRule({ push: normalized, timezoneOffset: 3 }, ENABLED), null);
});
