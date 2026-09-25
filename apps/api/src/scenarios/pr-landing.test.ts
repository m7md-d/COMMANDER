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
    defect: {
      observed: charged("batch_dump@omar", "large_diff@omar"),
      because:
        "Sara's commits were never recorded (her branch is not watched), so the merge re-delivers them as new: six commits and 60 file-touches, charged to Omar for pressing Merge. GitHub marks them distinct: false; the mapper does not read it. (0009 §2, §4)",
    },
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
    defect: {
      observed: charged("large_diff@omar"),
      because:
        "The 'Update branch' merge's second parent is on main, outside the push, so isWeighable gives up on the whole push and the landing merge counts at its full first-parent diff: 45 files. (0009 §2)",
    },
  },
  {
    id: "squash-merge",
    title: "PR squash-merged: one new commit carrying the whole branch",
    story: async (story) => {
      await prBranch(story);
      await land(story, "squash");
    },
    expect: CLEAN,
    defect: {
      observed: charged("large_diff@omar"),
      because:
        "A squash commit has one parent and a new sha: nothing in the push marks it as a landing, so its 45 files are new work by Omar. Only the pull-request link (commits/{sha}/pulls) knows. (0009 §2)",
    },
  },
  {
    id: "rebase-merge",
    title: "PR rebase-merged: GitHub rewrites all six commits onto main",
    story: async (story) => {
      await prBranch(story);
      await land(story, "rebase");
    },
    expect: CLEAN,
    defect: {
      observed: charged("batch_dump@omar", "large_diff@omar"),
      because:
        "GitHub rewrites every commit, so none of the new shas is on record: six new commits and 60 touches, charged to Omar. web-flow as committer exempts direct_push and nothing else. (0009 §2)",
    },
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
    defect: {
      observed: charged("large_diff@omar"),
      because:
        "normalizePush marks any push of 20+ commits truncated — the Events timeline's cap, not the webhook's (2,048) — so weighPush refuses to weigh it and the merge counts at its full diff. One commit fewer and the same PR is clean (eighteen-commit-pr). (0009 §6)",
    },
  },
  {
    id: "pr-from-a-fork",
    title: "PR from a fork: its commits were never pushed to this repository",
    story: async (story) => {
      await prBranch(story, { push: false });
      await land(story, "merge");
    },
    expect: CLEAN,
    defect: {
      observed: charged("batch_dump@omar", "large_diff@omar"),
      because:
        "A fork's commits were never pushed here, so neither the record nor `distinct` can recognise them as reviewed work — only the pull request can. (0009 §2)",
    },
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
    defect: {
      observed: charged("branch_deleted@omar"),
      because:
        "branch_deleted fires on any watched branch; the rules have no notion of which branches are protected. Deleting a merged PR's branch is the workflow finishing. (0009 §3)",
    },
  },
  {
    id: "lazy-commit-already-on-record",
    title: "PR carrying a 'wip' commit that was charged when the branch was pushed",
    story: async (story) => {
      await prBranch(story, { titles: ["wip"] });
      await land(story, "merge");
    },
    expect: CLEAN,
    defect: {
      observed: charged("lazy_message@omar"),
      because:
        "lazy_message reads every commit in the push, re-delivered ones included: the 'wip' already charged to Sara at her push is charged again, to Omar. (0009 §4)",
    },
  },
  {
    id: "night-commits-already-on-record",
    title: "branch written at 02:30 and recorded; merged at 11:00 the same day",
    story: async (story) => {
      await prBranch(story, { at: "2026-08-11T02:30:00+03:00" });
      await land(story, "merge", { at: "2026-08-11T11:00:00+03:00" });
    },
    expect: CLEAN,
    defect: {
      observed: charged("night_ops@omar"),
      because:
        "night_ops reads every commit in the push: Sara's 02:30 work, already on record, is charged again to Omar, who merged at 11:00. (0009 §4)",
    },
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
    defect: {
      observed: charged("lazy_message@omar"),
      because:
        "The charge is right and the person is wrong: every entry is written against the push's sender (delivery.ledger.ts), never the commit's author. (0009 §4)",
    },
  },
];

runCatalog("PR landings", scenarios);
