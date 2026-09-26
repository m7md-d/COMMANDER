/**
 * A pull request landing on the trunk — the event this platform misjudged most
 * visibly: a merge was charged as the largest push in the repository's history,
 * to whoever pressed the button.
 *
 * The policy these hold the code to: a PR that landed through GitHub is not a
 * batch dump, not a large diff and not a direct push. Its commits were the
 * branch's business, and work already on record is never charged twice. Where a
 * branch's commit genuinely deserves a charge, it is its author who answers for
 * it, not the person who merged.
 */

import { OMAR, SARA, LINA } from "./git.test.kit.js";
import { CLEAN, charged, runCatalog, type Scenario } from "./judge.test.kit.js";
import { seed, work, type MergeStyle, type Story, type WorkSpec } from "./story.test.kit.js";

const FEATURE = "feature/export";

/** Seed, then Sara's branch: by default six commits over 45 modules (60 touches), pushed. */
async function prBranch(story: Story, spec: Partial<WorkSpec> & { push?: boolean } = {}) {
  await seed(story);
  const on = spec.on ?? FEATURE;
  await story.branch(on, "main");
  await work(story, { on, by: SARA, commits: 6, width: 10, ...spec });
  if (spec.push !== false) await story.push(on, SARA);
}

function land(story: Story, style: MergeStyle, extra: { head?: string; at?: string } = {}) {
  return story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style, ...extra });
}

const scenarios: Scenario[] = [
  {
    id: "merge-commit-branch-on-record",
    title: "PR merged with a merge commit; its branch was pushed and recorded first",
    story: async (story) => {
      await prBranch(story);
      await land(story, "merge");
    },
    expect: CLEAN,
  },
  {
    id: "merge-commit-branch-never-recorded",
    title: "the same PR, on a front that watches main only",
    front: { watch: ["main"] },
    story: async (story) => {
      await prBranch(story);
      await land(story, "merge");
    },
    expect: CLEAN,
  },
  {
    id: "merge-after-update-branch",
    title: "PR merged after GitHub's 'Update branch' pulled main into it",
    story: async (story) => {
      await prBranch(story);
      await story.commit({ on: "main", by: LINA, title: "Document the ledger format", write: { "docs/ledger.md": "# Ledger\n" } });
      await story.push("main", LINA);
      await story.updateBranch({ head: FEATURE, base: "main", by: SARA });
      await land(story, "merge");
    },
    expect: CLEAN,
  },
  {
    id: "squash-merge",
    title: "PR squash-merged: one new commit carrying the whole branch",
    story: async (story) => {
      await prBranch(story);
      await land(story, "squash");
    },
    expect: CLEAN,
  },
  {
    id: "rebase-merge",
    title: "PR rebase-merged: GitHub rewrites all six commits onto main",
    story: async (story) => {
      await prBranch(story);
      await land(story, "rebase");
    },
    expect: CLEAN,
  },
  {
    id: "eighteen-commit-pr",
    title: "PR of 18 commits over 54 files, merged — nineteen commits in the push",
    story: async (story) => {
      await prBranch(story, { commits: 18, width: 3 });
      await land(story, "merge");
    },
    expect: CLEAN,
  },
  {
    id: "nineteen-commit-pr",
    title: "PR of 19 commits over 57 files, merged — twenty commits in the push",
    story: async (story) => {
      await prBranch(story, { commits: 19, width: 3 });
      await land(story, "merge");
    },
    expect: CLEAN,
  },
  {
    id: "pr-from-a-fork",
    title: "PR from a fork: its commits were never pushed to this repository",
    story: async (story) => {
      await prBranch(story, { push: false });
      await land(story, "merge");
    },
    expect: CLEAN,
  },
  {
    id: "head-branch-deleted-after-merge",
    title: "GitHub deletes the PR's branch once it is merged",
    story: async (story) => {
      await prBranch(story);
      await land(story, "merge");
      story.deleteBranch(FEATURE, OMAR);
    },
    expect: CLEAN,
  },
  {
    id: "lazy-commit-already-on-record",
    title: "PR carrying a 'wip' commit that was charged when the branch was pushed",
    story: async (story) => {
      await prBranch(story, { titles: ["wip"] });
      await land(story, "merge");
    },
    expect: CLEAN,
  },
  {
    id: "night-commits-already-on-record",
    title: "branch written at 02:30 and recorded; merged at 11:00 the same day",
    story: async (story) => {
      await prBranch(story, { at: "2026-08-11T02:30:00+03:00" });
      await land(story, "merge", { at: "2026-08-11T11:00:00+03:00" });
    },
    expect: CLEAN,
  },
  {
    id: "lazy-commit-first-seen-at-merge",
    title: "unwatched branch with a 'wip' commit, first seen when the PR lands",
    front: { watch: ["main"] },
    story: async (story) => {
      await prBranch(story, { commits: 3, width: 2, titles: ["wip"] });
      await land(story, "merge");
    },
    expect: charged("lazy_message@sara"),
  },
  {
    // GitHub lists a merged pull request against its commit only on the default
    // branch; anywhere else it lists the open ones. A squash onto a release line
    // is still a landing, not the pencil.
    id: "squash-merged-into-a-release-branch",
    title: "PR squash-merged into release/1.0, a branch other than the default",
    story: async (story) => {
      await seed(story);
      await story.branch("release/1.0", "main");
      await story.push("release/1.0", OMAR);
      await story.branch(FEATURE, "release/1.0");
      await work(story, { on: FEATURE, by: SARA, commits: 2, width: 3 });
      await story.push(FEATURE, SARA);
      await story.mergePullRequest({ number: 14, head: FEATURE, base: "release/1.0", author: SARA, by: OMAR, style: "squash" });
    },
    expect: CLEAN,
  },
  {
    id: "edited-in-the-browser-on-a-release-branch",
    title: "a file edited with GitHub's pencil, committed straight to a guarded release/1.0",
    front: { watchers: [{ pattern: "release/*", gravity: "guarded", promptId: null, model: "" }] },
    story: async (story) => {
      await seed(story);
      await story.branch("release/1.0", "main");
      await story.push("release/1.0", OMAR);
      await story.editOnGitHub({ on: "release/1.0", by: OMAR, title: "Pin the release version", write: { "VERSION": "1.0.1\n" } });
    },
    expect: charged("direct_push@omar"),
  },
];

runCatalog("PR landings", scenarios);
