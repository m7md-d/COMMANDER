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
import { seed, work, type Story } from "./story.test.kit.js";

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
    defect: {
      observed: charged("large_diff@omar"),
      because:
        "The reconciler hands the merge over alone — its branch is on record — so its second parent is absent, weighing is refused and it counts at its full diff. The webhook road gives a clean verdict. (0009 §1, §4)",
    },
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
    defect: {
      observed: charged("batch_dump@sara", "direct_push@sara", "large_diff@omar", "large_diff@sara"),
      because:
        "Grouped by author, Sara's six commits become a push of her own on main — a direct push and a batch — and Omar's merge is charged its full diff on top. The webhook road charges Omar alone (merge-commit-branch-never-recorded). (0009 §1, §4)",
    },
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
  },
  {
    // The recovered pushes are queued and admitted like live ones, so a road
    // that reads the wrong branch loses the push outright.
    id: "lost-push-on-a-wildcard-front",
    title: "a push to release/1.0 whose webhook is lost, on a front that watches release/* only",
    front: { watch: ["release/*"] },
    story: async (story) => {
      await seed(story);
      await story.branch(RELEASE, "main");
      await story.commit({ on: RELEASE, by: OMAR, title: "fix", write: { "src/core/m003.ts": 'export const part3 = "rounded";\n' } });
      await story.push(RELEASE, OMAR, { lost: true });
      story.reconcile();
    },
    expect: charged("lazy_message@omar"),
    defect: {
      observed: CLEAN,
      because:
        "A wildcard is not a branch the commits API can read, so the reconciler reads the default branch instead — which release/* does not cover. Everything it recovers is skipped as unwatched, and release/1.0 is never read. (reconciler.ts resolveBranches)",
    },
  },
  {
    id: "merge-without-the-app",
    title: "the PR merged on a front with no GitHub App installed",
    front: { app: false },
    story: (story) => prMerged(story, false),
    expect: CLEAN,
    defect: {
      observed: charged("large_diff@omar"),
      because:
        "Without the App there are no parents, so the merge cannot be recognised and its 45 files count as Omar's. Without the evidence to tell, the platform should say it could not tell. (0009 §2)",
    },
  },
];

runCatalog("Same history, other roads", scenarios);
