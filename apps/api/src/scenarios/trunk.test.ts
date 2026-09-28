/**
 * Work that reaches the trunk without a pull request — the thing `direct_push`
 * exists to see, in every shape it actually arrives in.
 *
 * The policy: anything that lands on the trunk without passing through a pull
 * request is a direct push, whatever its commit message says. A merge made on a
 * laptop and pushed is a merge nobody reviewed. Whether something is a merge is
 * decided by its parents, never by its title.
 */

import { LINA, OMAR, SARA } from "./git.test.kit.js";
import { charged, runCatalog, type Scenario } from "./judge.test.kit.js";
import { modules, REPOSITORY, seed, work, type Story } from "./story.test.kit.js";

const FEATURE = "feature/export";

/** Sara edits the same 15 report modules in three commits, and pushes them to main. */
async function threePasses(story: Story) {
  await seed(story);
  for (const round of [1, 2, 3]) {
    const write = modules({ dir: "src/reports", count: 15, stamp: `round-${round}` });
    await story.commit({ on: "main", by: SARA, title: `Tune the report layout, pass ${round}`, write });
  }
  await story.push("main", SARA);
}

/** Lina pushes 48 files to main; Sara, behind, commits — twice on two files by default — pulls with a merge, and pushes. */
async function pulledThenPushed(story: Story, own = { commits: 2, width: 2 }) {
  await seed(story);
  await story.branch("sara-clone", "main");
  await work(story, { on: "main", by: LINA, commits: 3, width: 20, dir: "src/reports" });
  await story.push("main", LINA);
  await work(story, { on: "sara-clone", by: SARA, ...own, dir: "src/export" });
  await story.merge({ into: "sara-clone", from: "main", by: SARA, message: `Merge branch 'main' of github.com:${REPOSITORY}` });
  await story.push("sara-clone", SARA, { to: "main" });
}

const scenarios: Scenario[] = [
  {
    id: "two-commits-pushed-to-main",
    title: "two local commits pushed straight to main",
    story: async (story) => {
      await seed(story);
      await work(story, { on: "main", by: SARA, commits: 2, width: 3 });
      await story.push("main", SARA);
    },
    expect: charged("direct_push@sara"),
  },
  {
    id: "seven-commits-pushed-to-main",
    title: "seven local commits pushed to main at once",
    story: async (story) => {
      await seed(story);
      await work(story, { on: "main", by: SARA, commits: 7, width: 2 });
      await story.push("main", SARA);
    },
    expect: charged("batch_dump@sara", "direct_push@sara"),
  },
  {
    id: "same-files-edited-three-times",
    title: "three commits editing the same 15 files, pushed to main",
    story: threePasses,
    expect: charged("direct_push@sara"),
  },
  {
    id: "commit-titled-merge",
    title: "an ordinary commit whose title begins with 'Merge', pushed to main",
    story: async (story) => {
      await seed(story);
      await story.commit({ on: "main", by: SARA, title: "Merge the export fixes", write: modules({ dir: "src/export", count: 2, stamp: "fix" }) });
      await story.push("main", SARA);
    },
    expect: charged("direct_push@sara"),
  },
  {
    id: "local-merge-default-message",
    title: "branch merged on a laptop with git's default message, pushed to main",
    story: async (story) => {
      await branchPushed(story);
      await story.merge({ into: "main", from: FEATURE, by: SARA, message: `Merge branch '${FEATURE}'` });
      await story.push("main", SARA);
    },
    expect: charged("direct_push@sara"),
  },
  {
    id: "local-merge-own-message",
    title: "the same local merge, written with a message of Sara's own",
    story: async (story) => {
      await branchPushed(story);
      await story.merge({ into: "main", from: FEATURE, by: SARA, message: "Integrate the export feature" });
      await story.push("main", SARA);
    },
    expect: charged("direct_push@sara"),
  },
  {
    id: "octopus-merge-on-a-laptop",
    title: "two branches merged at once (three parents) and pushed to main",
    story: async (story) => {
      await seed(story);
      for (const name of ["feature/a", "feature/b"]) {
        await story.branch(name, "main");
        await work(story, { on: name, by: SARA, commits: 2, width: 2 });
        await story.push(name, SARA);
      }
      await story.merge({ into: "main", from: ["feature/a", "feature/b"], by: SARA, message: "Merge branches 'feature/a' and 'feature/b'" });
      await story.push("main", SARA);
    },
    expect: charged("direct_push@sara"),
  },
  {
    id: "git-pull-merge-then-push",
    title: "Sara pulls Lina's 48-file change with a merge, then pushes her two commits",
    story: pulledThenPushed,
    expect: charged("direct_push@sara"),
  },
  {
    id: "foxtrot-merge",
    title: "main merged into a feature, and the feature pushed over main",
    story: async (story) => {
      await branchPushed(story);
      await work(story, { on: "main", by: LINA, commits: 3, width: 20, dir: "src/reports" });
      await story.push("main", LINA);
      await story.merge({ into: FEATURE, from: "main", by: SARA, message: `Merge branch 'main' into ${FEATURE}` });
      await story.push(FEATURE, SARA, { to: "main" });
    },
    expect: charged("direct_push@sara"),
  },
  {
    id: "edited-in-the-browser",
    title: "a file edited with GitHub's pencil, committed straight to main",
    story: async (story) => {
      await seed(story);
      const write = { "src/core/m000.ts": 'export const part0 = "edited in the browser";\n' };
      await story.editOnGitHub({ on: "main", by: SARA, title: "Correct the ledger header", write });
    },
    expect: charged("direct_push@sara"),
  },
  {
    id: "cherry-pick-to-main",
    title: "one commit of a pushed branch cherry-picked onto main",
    story: async (story) => {
      const [first] = await branchPushed(story);
      await story.git.cherryPick({ onto: "main", shas: [first ?? ""], committer: SARA });
      await story.push("main", SARA);
    },
    expect: charged("direct_push@sara"),
  },
  {
    id: "merge-reverted-on-main",
    title: "a merged 45-file PR reverted with git revert -m 1 and pushed",
    story: async (story) => {
      await branchPushed(story, { commits: 6, width: 10 });
      await story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style: "merge" });
      await story.git.revertMerge({ on: "main", merge: await story.git.resolve("main"), by: SARA });
      await story.push("main", SARA);
    },
    expect: charged("direct_push@sara", "large_diff@sara"),
  },
  {
    id: "main-rewound-by-force",
    title: "main forced back two commits — history deleted, nothing added",
    story: async (story) => {
      await seed(story);
      const [first] = await work(story, { on: "main", by: SARA, commits: 3, width: 2 });
      await story.push("main", SARA);
      await story.git.reset({ branch: "main", to: first ?? "" });
      await story.push("main", SARA);
    },
    expect: charged("force_push@sara"),
  },
  {
    id: "main-rewritten-by-force",
    title: "main's last commit replaced and force-pushed",
    story: async (story) => {
      await seed(story);
      const [first] = await work(story, { on: "main", by: SARA, commits: 2, width: 2 });
      await story.push("main", SARA);
      await story.git.reset({ branch: "main", to: first ?? "" });
      await story.commit({ on: "main", by: SARA, title: "Rework the second export step", write: modules({ dir: "src/main", from: 50, count: 2, stamp: "rework" }) });
      await story.push("main", SARA);
    },
    expect: charged("direct_push@sara", "force_push@sara"),
  },
  {
    id: "same-files-edited-three-times-without-the-app",
    title: "three commits editing the same 15 files, pushed to main, on a front with no GitHub App",
    front: { app: false },
    story: threePasses,
    expect: charged("direct_push@sara"),
  },
  {
    id: "git-pull-merge-over-a-large-change",
    title: "Sara commits 48 files of her own, pulls Lina's 48 with a merge, and pushes",
    story: (story) => pulledThenPushed(story, { commits: 3, width: 20 }),
    expect: charged("direct_push@sara", "large_diff@sara"),
  },
  {
    id: "git-pull-merge-without-the-app",
    title: "Sara pulls Lina's 48-file change with a merge and pushes, on a front with no GitHub App",
    front: { app: false },
    story: pulledThenPushed,
    expect: charged("direct_push@sara"),
  },
];

/** Seed, then Sara's feature branch — two small commits by default — pushed. */
async function branchPushed(story: Parameters<Scenario["story"]>[0], size = { commits: 2, width: 3 }) {
  await seed(story);
  await story.branch(FEATURE, "main");
  const shas = await work(story, { on: FEATURE, by: SARA, ...size });
  await story.push(FEATURE, SARA);
  return shas;
}

runCatalog("Straight onto the trunk", scenarios);
