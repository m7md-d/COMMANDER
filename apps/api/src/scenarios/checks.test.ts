/**
 * What the measurements charge, and to whom.
 *
 * A check violates on the crossing — a file taken past its limit — and the
 * crossing belongs to the work that made it: on the branch where it was made,
 * to the person who made it, once. These fronts switch every rule off, so a
 * verdict here is the checks alone.
 */

import { LINA, OMAR, SARA } from "./git.test.kit.js";
import { CLEAN, charged, runCatalog, type Scenario } from "./judge.test.kit.js";
import { mergeWithDefaults } from "@/domain/violations/engine.js";
import { seed, type Story } from "./story.test.kit.js";

const FEATURE = "feature/export";
const RELEASE = "release/1.0";
const LEDGER = "src/core/ledger.ts";

const OFF = { enabled: false };
const QUIET = mergeWithDefaults({
  force_push: OFF,
  batch_dump: OFF,
  direct_push: OFF,
  lazy_message: OFF,
  night_ops: OFF,
  branch_deleted: OFF,
  merge_residue: OFF,
});

/** A module of exactly `lines` lines; `stamp` makes each version a different blob. */
function sized(lines: number, stamp: string): string {
  return Array.from({ length: lines }, (_, line) => `export const entry${line} = "${stamp}";`).join("\n") + "\n";
}

/** Seed, and Lina's ledger on main at 190 lines — ten under the limit. */
async function ledgerOnMain(story: Story) {
  await seed(story);
  await story.commit({ on: "main", by: LINA, title: "Add the ledger", write: { [LEDGER]: sized(190, "first") } });
  await story.push("main", LINA);
}

const REPORT = "src/core/report.ts";
const MOVED = "src/reports/monthly.ts";

/** Seed, and Lina's 300-line report on main — created over the limit, so charged to her then. */
async function reportOnMain(story: Story) {
  await seed(story);
  await story.commit({ on: "main", by: LINA, title: "Add the monthly report", write: { [REPORT]: sized(300, "report") } });
  await story.push("main", LINA);
}

/** …then Sara takes it to 210 on her own branch and pushes the branch. */
async function sarasCrossing(story: Story) {
  await ledgerOnMain(story);
  await story.branch(FEATURE, "main");
  await story.commit({ on: FEATURE, by: SARA, title: "Track refunds in the ledger", write: { [LEDGER]: sized(210, "refunds") } });
  await story.push(FEATURE, SARA);
}

const scenarios: Scenario[] = [
  {
    id: "crossing-on-a-work-branch",
    title: "Sara takes the ledger from 190 lines to 210 on her own branch",
    front: { rules: QUIET },
    story: sarasCrossing,
    expect: charged("file_lines@sara"),
  },
  {
    id: "crossing-charged-to-whoever-merged",
    title: "the same branch merged by Omar through the PR",
    front: { rules: QUIET },
    story: async (story) => {
      await sarasCrossing(story);
      await story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style: "merge" });
    },
    expect: CLEAN,
  },
  {
    id: "main-crossing-charged-to-a-release-push",
    title: "Lina grows the ledger on main; Omar then edits one module on release/1.0, on a front that watches release/* only",
    front: { watch: ["release/*"], rules: QUIET },
    story: async (story) => {
      await ledgerOnMain(story);
      await story.branch(RELEASE, "main");
      await story.push(RELEASE, OMAR);
      await story.commit({ on: "main", by: LINA, title: "Track refunds in the ledger", write: { [LEDGER]: sized(210, "refunds") } });
      await story.push("main", LINA);
      await story.editOnGitHub({ on: RELEASE, by: OMAR, title: "Round the export totals", write: { "src/core/m003.ts": 'export const part3 = "rounded";\n' } });
    },
    expect: CLEAN,
  },
  {
    id: "first-release-push-charged-for-main",
    title: "Omar's first push to release/1.0, cut from a main that holds a 300-line report",
    front: { watch: ["release/*"], rules: QUIET },
    story: async (story) => {
      await seed(story);
      await story.commit({ on: "main", by: LINA, title: "Add the monthly report", write: { "src/core/report.ts": sized(300, "report") } });
      await story.push("main", LINA);
      await story.branch(RELEASE, "main");
      await story.commit({ on: RELEASE, by: OMAR, title: "Round the export totals", write: { "src/core/m003.ts": 'export const part3 = "rounded";\n' } });
      await story.push(RELEASE, OMAR);
    },
    expect: CLEAN,
  },
  {
    id: "long-file-moved",
    title: "Sara moves Lina's 300-line report to another folder, unchanged",
    front: { rules: QUIET },
    story: async (story) => {
      await reportOnMain(story);
      await story.branch(FEATURE, "main");
      await story.commit({ on: FEATURE, by: SARA, title: "File the report with the others", move: [[REPORT, MOVED]] });
      await story.push(FEATURE, SARA);
    },
    expect: CLEAN,
  },
  {
    id: "long-file-moved-and-edited",
    title: "Sara moves the 300-line report and fixes one line of it",
    front: { rules: QUIET },
    story: async (story) => {
      await reportOnMain(story);
      await story.branch(FEATURE, "main");
      await story.commit({ on: FEATURE, by: SARA, title: "File the report with the others", move: [[REPORT, MOVED]] });
      await story.commit({ on: FEATURE, by: SARA, title: "Correct the report heading", write: { [MOVED]: sized(300, "report").replace("entry0", "heading") } });
      await story.push(FEATURE, SARA);
    },
    expect: CLEAN,
  },
  {
    id: "unwatched-branch-merged",
    title: "Sara's crossing merged by Omar, on a front that watches main only",
    front: { watch: ["main"], rules: QUIET },
    story: async (story) => {
      await sarasCrossing(story);
      await story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style: "merge" });
    },
    expect: charged("file_lines@sara"),
    defect: {
      observed: charged("file_lines@omar"),
      because:
        "Sara's branch is not watched, so her crossing is new work when it lands — and it is hers, but every charge goes to whoever pushed the merge. (0009 §4)",
    },
  },
];

runCatalog("What the measurements charge", scenarios);
