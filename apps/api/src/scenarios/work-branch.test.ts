/**
 * Life on a work branch — where commits are born, rebased and thrown away.
 *
 * The policy: the rules that protect a trunk (direct pushes, force pushes,
 * deletions) describe ordinary work when they meet a personal branch. Pushing
 * your own commits to your own branch is how a pull request is opened, and
 * rebasing it is how it is kept current. A branch that is protected — a
 * release line a watcher marks guarded — is still protected; one nobody marked
 * is not guessed at.
 */

import { LINA, SARA } from "./git.test.kit.js";
import { CLEAN, charged, IGNORED, runCatalog, SKIPPED, type Scenario } from "./judge.test.kit.js";
import { seed, work } from "./story.test.kit.js";

const FEATURE = "feature/export";
const GUARDED_RELEASES = { pattern: "release/*", gravity: "guarded" as const, promptId: null, model: "" };

const scenarios: Scenario[] = [
  {
    id: "feature-branch-pushed",
    title: "Sara pushes two commits to her own feature branch",
    story: async (story) => {
      await seed(story);
      await story.branch(FEATURE, "main");
      await work(story, { on: FEATURE, by: SARA, commits: 2, width: 2 });
      await story.push(FEATURE, SARA);
    },
    expect: CLEAN,
  },
  {
    id: "feature-rebased-and-force-pushed",
    title: "Sara rebases her branch onto a moved main and force-pushes it",
    story: async (story) => {
      await seed(story);
      await story.branch(FEATURE, "main");
      await work(story, { on: FEATURE, by: SARA, commits: 3, width: 2 });
      await story.push(FEATURE, SARA);
      await story.commit({ on: "main", by: LINA, title: "Document the ledger format", write: { "docs/ledger.md": "# Ledger\n" } });
      await story.push("main", LINA);
      await story.git.rebase({ branch: FEATURE, onto: "main", by: SARA });
      await story.push(FEATURE, SARA);
    },
    expect: CLEAN,
  },
  {
    id: "update-branch-button",
    title: "GitHub's 'Update branch' merges main into Sara's pull request",
    story: async (story) => {
      await seed(story);
      await story.branch(FEATURE, "main");
      await work(story, { on: FEATURE, by: SARA, commits: 2, width: 2 });
      await story.push(FEATURE, SARA);
      await work(story, { on: "main", by: LINA, commits: 2, width: 4, dir: "src/reports" });
      await story.push("main", LINA);
      await story.updateBranch({ head: FEATURE, base: "main", by: SARA });
    },
    expect: CLEAN,
  },
  {
    // Protected because the front says so: a watcher marks release lines guarded,
    // which is what makes a branch other than the default a main line (0009 §3).
    id: "release-branch-deleted",
    title: "a release line deleted — the one deletion that is an attack on history",
    front: { watchers: [GUARDED_RELEASES] },
    story: async (story) => {
      await seed(story);
      await story.branch("release/2.0", "main");
      await story.commit({ on: "release/2.0", by: LINA, title: "Pin the release version", write: { "VERSION": "2.0.0\n" } });
      await story.push("release/2.0", LINA);
      story.deleteBranch("release/2.0", SARA);
    },
    expect: charged("branch_deleted@sara"),
  },
  {
    // The same deletion on a front that never said its release lines are main:
    // the platform does not guess which branches matter.
    id: "unmarked-release-branch-deleted",
    title: "a release line deleted on a front that marks no branch guarded",
    story: async (story) => {
      await seed(story);
      await story.branch("release/2.0", "main");
      await story.commit({ on: "release/2.0", by: LINA, title: "Pin the release version", write: { "VERSION": "2.0.0\n" } });
      await story.push("release/2.0", LINA);
      story.deleteBranch("release/2.0", SARA);
    },
    expect: CLEAN,
  },
  {
    id: "branch-created-with-nothing-new",
    title: "a new branch pushed at a commit main already has",
    story: async (story) => {
      await seed(story);
      await story.branch("spike/ledger", "main");
      await story.push("spike/ledger", SARA);
    },
    expect: SKIPPED,
  },
  {
    id: "tag-pushed",
    title: "a release tag pushed",
    story: async (story) => {
      await seed(story);
      await story.pushTag("v2.0.0", LINA);
    },
    expect: IGNORED,
  },
];

runCatalog("Life on a work branch", scenarios);
