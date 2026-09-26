/**
 * What the measurements charge, and to whom.
 *
 * A check violates on the crossing — a file taken past its limit — and the
 * crossing belongs to the work that made it: on the branch where it was made,
 * to the person who made it, once. Whoever lands it on a main line unfixed —
 * a branch whose crossing was reported, or someone else's commits — shares it:
 * the author for writing it, the lander for landing it (`landed_unfixed`).
 * These fronts switch every engagement rule off, so a verdict here is the
 * checks and that one share alone.
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
    // Sara answered when her branch was pushed; the crossing is still there when
    // Omar merges it, and landing it unfixed is his.
    id: "crossing-charged-to-whoever-merged",
    title: "the same branch merged by Omar through the PR, the crossing still standing",
    front: { rules: QUIET },
    story: async (story) => {
      await sarasCrossing(story);
      await story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style: "merge" });
    },
    expect: charged("landed_unfixed@omar"),
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
    id: "crossing-pushed-to-main-by-a-maintainer",
    title: "Sara's crossing, on a branch main-only does not watch, pushed straight to main by Lina",
    front: { watch: ["main"], rules: QUIET },
    story: async (story) => {
      await sarasCrossing(story);
      await story.push(FEATURE, LINA, { to: "main" });
    },
    expect: charged("file_lines@sara", "landed_unfixed@lina"),
  },
  {
    id: "crossing-by-two-hands",
    title: "Lina takes the ledger to 210 on Sara's branch, Sara adds two lines, and Sara pushes both",
    front: { rules: QUIET },
    story: async (story) => {
      await ledgerOnMain(story);
      await story.branch(FEATURE, "main");
      await story.commit({ on: FEATURE, by: LINA, title: "Track refunds in the ledger", write: { [LEDGER]: sized(210, "refunds") } });
      await story.commit({ on: FEATURE, by: SARA, title: "Track credits in the ledger", write: { [LEDGER]: sized(212, "credits") } });
      await story.push(FEATURE, SARA);
    },
    expect: charged("file_lines@lina"),
    defect: {
      observed: CLEAN,
      because:
        "A file two people changed in one push names nobody: the crossing is measured between the push's two ends, and telling whose commit crossed it would take a measurement per commit. Silent where it used to charge Sara, who pushed, with Lina's crossing (attribution.ts handsOnPaths, 0009 §4).",
    },
  },
  {
    id: "unwatched-branch-merged",
    title: "Sara's crossing merged by Omar, on a front that watches main only",
    front: { watch: ["main"], rules: QUIET },
    story: async (story) => {
      await sarasCrossing(story);
      await story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style: "merge" });
    },
    expect: charged("file_lines@sara", "landed_unfixed@omar"),
  },
  {
    id: "crossing-fixed-before-merge",
    title: "Sara's crossing, reported on her branch, brought back under before Omar merges",
    front: { rules: QUIET },
    story: async (story) => {
      await sarasCrossing(story);
      await story.commit({ on: FEATURE, by: SARA, title: "Split the refunds out of the ledger", write: { [LEDGER]: sized(195, "split") } });
      await story.push(FEATURE, SARA);
      await story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style: "merge" });
    },
    expect: CLEAN,
  },
  {
    // Merging main into a feature brings it nothing a review has not seen:
    // Lina answered on main, and Sara lands nothing by syncing.
    id: "main-pulled-into-a-feature",
    title: "Lina's crossing on main reaches Sara's branch through 'Update branch'",
    front: { rules: QUIET },
    story: async (story) => {
      await ledgerOnMain(story);
      await story.branch(FEATURE, "main");
      await story.commit({ on: FEATURE, by: SARA, title: "Export the ledger as CSV", write: { "src/export/csv.ts": "export const csv = true;\n" } });
      await story.push(FEATURE, SARA);
      await story.commit({ on: "main", by: LINA, title: "Track refunds in the ledger", write: { [LEDGER]: sized(210, "refunds") } });
      await story.push("main", LINA);
      await story.updateBranch({ head: FEATURE, base: "main", by: SARA });
    },
    expect: CLEAN,
  },
  {
    id: "crossing-squash-merged",
    title: "Sara's reported crossing squash-merged by Omar, still standing",
    front: { rules: QUIET },
    story: async (story) => {
      await sarasCrossing(story);
      await story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style: "squash" });
    },
    expect: charged("landed_unfixed@omar"),
    defect: {
      observed: charged("file_lines@sara", "landed_unfixed@omar"),
      because:
        "A squash commit is new to the record, so Sara's crossing — charged when her branch was pushed — reads as new work of hers and is charged to her a second time. Only the pull-request link knows the squash is her reviewed branch (0009 §2).",
    },
  },
];

runCatalog("What the measurements charge", scenarios);
