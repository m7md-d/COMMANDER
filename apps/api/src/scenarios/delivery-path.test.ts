/**
 * The same history, arriving by another road.
 *
 * A push reaches the judgement either as a webhook or — when the server was
 * down — as commits the reconciler finds later, and with or without the GitHub
 * App to enrich it. The policy is that the road does not change the verdict:
 * two readings of one repository that can disagree are worse than one reading.
 */

import { OMAR, SARA } from "./git.test.kit.js";
import { CLEAN, charged, runCatalog, type Scenario } from "./judge.test.kit.js";
import { modules, seed, work, type Story } from "./story.test.kit.js";

const FEATURE = "feature/export";
const RELEASE = "release/1.0";

/** Seed; Sara's six-commit, 45-file branch, pushed; Omar merges it — its webhook lost when `lost`. */
async function prMerged(story: Story, lost: boolean) {
  await seed(story);
  await story.branch(FEATURE, "main");
  await work(story, { on: FEATURE, by: SARA, commits: 6, width: 10 });
  await story.push(FEATURE, SARA);
  await story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style: "merge", lost });
}

const scenarios: Scenario[] = [
  {
    id: "reconciled-merge-branch-on-record",
    title: "the PR's merge webhook is lost; the reconciler recovers the merge",
    story: async (story) => {
      await prMerged(story, true);
      story.reconcile();
    },
    expect: CLEAN,
  },
  {
    id: "reconciled-merge-branch-never-recorded",
    title: "the same, on a front that watches main only",
    front: { watch: ["main"] },
    story: async (story) => {
      await prMerged(story, true);
      story.reconcile();
    },
    expect: CLEAN,
  },
  {
    id: "reconciled-direct-push",
    title: "a direct push to main whose webhook is lost, recovered by the reconciler",
    story: async (story) => {
      await seed(story);
      await work(story, { on: "main", by: SARA, commits: 2, width: 3 });
      await story.push("main", SARA, { lost: true });
      story.reconcile();
    },
    expect: charged("direct_push@sara"),
    defect: {
      observed: CLEAN,
      because:
        "A recovered push names no pusher: the push event is gone, and git records who wrote and who committed a commit, never who pushed it. Naming the author instead, as grouping by author did, charged Sara with Lina's push in contributors-branch-pushed-by-a-maintainer-webhook-lost. GitHub's events timeline names the actor of each push, and is not read (reconciler.mapper.ts recoveredPush, 0009 §4).",
    },
  },
  {
    // A pattern is not a branch the commits API can read; the reconciler matches
    // it against the branches there are. The pencil's edit is a direct push, and a
    // recovered push names no pusher to charge it to, so the road is the only
    // thing under test.
    id: "lost-push-on-a-wildcard-front",
    title: "an edit to release/1.0 on GitHub whose webhook is lost, on a front that watches release/* only",
    front: { watch: ["release/*"] },
    story: async (story) => {
      await seed(story);
      await story.branch(RELEASE, "main");
      await story.push(RELEASE, OMAR);
      await story.editOnGitHub({ on: RELEASE, by: OMAR, title: "fix", write: { "src/core/m003.ts": 'export const part3 = "rounded";\n' }, lost: true });
      story.reconcile();
    },
    expect: charged("lazy_message@omar"),
  },
  {
    // Nothing was lost here. The branch's history holds main's commits, and a
    // front that does not watch main never recorded them.
    id: "branch-cut-from-an-unwatched-main",
    title: "release/1.0 cut from main on a front that watches release/1.0 only; the reconciler passes",
    front: { watch: [RELEASE] },
    story: async (story) => {
      await seed(story);
      await story.branch(RELEASE, "main");
      await story.push(RELEASE, OMAR);
      story.reconcile();
    },
    expect: CLEAN,
  },
  {
    id: "lost-push-on-a-branch-of-an-all-branch-front",
    title: "an edit to feature/export on GitHub whose webhook is lost, on the shipped front that watches every branch",
    story: async (story) => {
      await seed(story);
      await story.branch(FEATURE, "main");
      await story.push(FEATURE, SARA);
      await story.editOnGitHub({ on: FEATURE, by: SARA, title: "wip", write: { "src/core/m004.ts": 'export const part4 = "draft";\n' }, lost: true });
      story.reconcile();
    },
    expect: charged("lazy_message@sara"),
    defect: {
      observed: CLEAN,
      because:
        "A front that watches every branch is reconciled on its default branch alone: reading them all costs a request per branch on every pass, stale ones included. A push lost anywhere else stays lost. A cost bound, chosen — reconciler.mapper.ts branchesToReconcile.",
    },
  },
  {
    id: "lost-push-overtaken-by-a-later-one",
    title: "Sara's push to main is lost; Omar's later push to his branch arrives before the reconciler passes",
    story: async (story) => {
      await seed(story);
      await story.branch(FEATURE, "main");
      await work(story, { on: "main", by: SARA, commits: 2, width: 3, titles: ["wip"] });
      await story.push("main", SARA, { lost: true });
      await work(story, { on: FEATURE, by: OMAR, commits: 1, width: 2 });
      await story.push(FEATURE, OMAR);
      story.reconcile();
    },
    expect: charged("direct_push@sara", "lazy_message@sara"),
    defect: {
      observed: CLEAN,
      because:
        "The cursor is the newest commit on record anywhere in the repository. Omar's later push moved it past Sara's lost commits, so main is read from after them and even her 'wip' is never seen. Reading a branch back to the first commit on record, rather than by date, would not skip them (reconciler.ts computeSince) — and would recover them as a push naming no pusher, charging the 'wip' alone (reconciled-direct-push).",
    },
  },
  {
    id: "merge-without-the-app",
    title: "the PR merged on a front with no GitHub App installed",
    front: { app: false },
    story: (story) => prMerged(story, false),
    expect: CLEAN,
  },
  {
    id: "lazy-commit-on-a-front-with-no-channel",
    title: "Sara pushes a 'wip' to her branch, on a front with no Discord channel",
    front: { channel: false },
    story: async (story) => {
      await seed(story);
      await story.branch(FEATURE, "main");
      await story.commit({ on: FEATURE, by: SARA, title: "wip", write: modules({ dir: "src/export", count: 2, stamp: "wip" }) });
      await story.push(FEATURE, SARA);
    },
    expect: charged("lazy_message@sara"),
  },
];

runCatalog("Same history, other roads", scenarios);
