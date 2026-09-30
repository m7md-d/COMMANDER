/**
 * What a merge brings that none of its commits did.
 *
 * `merge_residue` promises two things, and these hold it to both: an honest
 * merge — clean, conflict-resolved, renamed — is never accused, and a merge
 * that carries content no commit contains is always caught. The first promise
 * matters more. A rule that exists to catch bad faith and fires on good faith
 * does more damage than having no rule.
 *
 * The local merges here are written with their own message, so `direct_push`
 * reads them the same way every time and the residue is the only variable.
 */

import { LINA, OMAR, SARA } from "./git.test.kit.js";
import { CLEAN, charged, runCatalog, type Scenario } from "./judge.test.kit.js";
import { modules, seed, work, type Story } from "./story.test.kit.js";
import type { Change } from "./git.test.kit.js";

const FEATURE = "feature/export";
const MESSAGE = "Integrate the export feature";

/** Seed; Sara's two-commit branch, pushed; Omar merges it on his laptop with `amend` folded in. */
async function mergeLocally(story: Story, amend?: Change) {
  await seed(story);
  await story.branch(FEATURE, "main");
  await work(story, { on: FEATURE, by: SARA, commits: 2, width: 3 });
  await story.push(FEATURE, SARA);
  await story.merge({ into: "main", from: FEATURE, by: OMAR, message: MESSAGE, ...(amend && { amend }) });
  await story.push("main", OMAR);
}

/** Both sides rewrite the same line of `src/core/m001.ts`; Omar resolves it as `resolution`. */
async function conflictResolvedAs(story: Story, resolution: string) {
  await seed(story);
  await story.branch(FEATURE, "main");
  await story.commit({ on: FEATURE, by: SARA, title: "Name the ledger total", write: { "src/core/m001.ts": 'export const part1 = "total";\n' } });
  await story.push(FEATURE, SARA);
  await story.commit({ on: "main", by: LINA, title: "Name the ledger sum", write: { "src/core/m001.ts": 'export const part1 = "sum";\n' } });
  await story.push("main", LINA);
  await story.merge({ into: "main", from: FEATURE, by: OMAR, message: MESSAGE, amend: { write: { "src/core/m001.ts": resolution } } });
  await story.push("main", OMAR);
}

/** Twenty lines, so git has something to measure a rename's similarity by. */
function legacyTotals(variant: string): string {
  return Array.from({ length: 20 }, (_, line) => `export const total${line} = "${variant}-${line}";`).join("\n") + "\n";
}

/** A 20-line module on main, moved by Sara's branch — and, when `rewrite`, rewritten after. */
async function renamedOnBranch(story: Story, rewrite: boolean) {
  await seed(story);
  await story.commit({ on: "main", by: LINA, title: "Add the legacy totals", write: { "src/core/totals-legacy.ts": legacyTotals("legacy") } });
  await story.push("main", LINA);
  await story.branch(FEATURE, "main");
  await story.commit({ on: FEATURE, by: SARA, title: "Give the totals module its name", move: [["src/core/totals-legacy.ts", "src/core/totals.ts"]] });
  if (rewrite) {
    await story.commit({ on: FEATURE, by: SARA, title: "Rewrite the totals from scratch", write: { "src/core/totals.ts": legacyTotals("rewritten") } });
  }
  await story.push(FEATURE, SARA);
  await story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style: "merge" });
}

const scenarios: Scenario[] = [
  {
    id: "merge-adds-a-file",
    title: "a local merge that adds a file no commit contains",
    story: (story) => mergeLocally(story, { write: { "src/core/audit-bypass.ts": "export const skipAudit = true;\n" } }),
    expect: charged("direct_push@omar", "merge_residue@omar"),
  },
  {
    id: "merge-edits-an-untouched-file",
    title: "a local merge that edits a file neither side touched",
    story: (story) => mergeLocally(story, { write: { "src/core/m005.ts": 'export const part5 = "patched in the merge";\n' } }),
    expect: charged("direct_push@omar", "merge_residue@omar"),
  },
  {
    id: "merge-deletes-an-untouched-file",
    title: "a local merge that deletes a file neither side touched",
    story: (story) => mergeLocally(story, { remove: ["src/core/m006.ts"] }),
    expect: charged("direct_push@omar", "merge_residue@omar"),
  },
  {
    // A branch's rename counts both of its paths as carried; a rename the merge
    // made by itself is still residue, both paths of it.
    id: "merge-renames-an-untouched-file",
    title: "a local merge that renames a file neither side touched",
    story: (story) => mergeLocally(story, { move: [["src/core/m007.ts", "src/core/m007-archived.ts"]] }),
    expect: charged("direct_push@omar", "merge_residue@omar"),
  },
  {
    id: "clean-local-merge",
    title: "a local merge that adds nothing of its own",
    story: (story) => mergeLocally(story),
    expect: charged("direct_push@omar"),
  },
  {
    id: "conflict-resolved-honestly",
    title: "a conflict resolved by keeping one side's line",
    story: (story) => conflictResolvedAs(story, 'export const part1 = "total";\n'),
    expect: charged("direct_push@omar"),
  },
  {
    id: "conflict-resolution-smuggles-a-line",
    title: "a conflict resolved with an extra line neither side wrote",
    story: (story) => conflictResolvedAs(story, 'export const part1 = "total";\nexport const skipAudit = true;\n'),
    expect: charged("direct_push@omar", "merge_residue@omar"),
  },
  {
    id: "strategy-ours",
    title: "git merge -s ours: the branch recorded as merged, its changes discarded",
    story: async (story) => {
      await seed(story);
      await story.branch(FEATURE, "main");
      await work(story, { on: FEATURE, by: SARA, commits: 2, width: 3 });
      await story.push(FEATURE, SARA);
      await story.merge({ into: "main", from: FEATURE, by: OMAR, message: "Record the export branch as merged", strategy: "ours" });
      await story.push("main", OMAR);
    },
    expect: charged("direct_push@omar"),
  },
  {
    id: "pure-rename-merged",
    title: "PR that only renames a file, merged",
    story: (story) => renamedOnBranch(story, false),
    expect: CLEAN,
  },
  {
    id: "rename-then-rewrite-merged",
    title: "PR that renames a file and then rewrites it, merged",
    story: (story) => renamedOnBranch(story, true),
    expect: CLEAN,
  },
  {
    id: "three-hundred-file-page",
    title: "PR whose one commit touches 350 files, past GitHub's 300-file page",
    story: async (story) => {
      await seed(story);
      await story.branch(FEATURE, "main");
      await story.commit({ on: FEATURE, by: SARA, title: "Generate the locale catalogue", write: modules({ dir: "src/locales", count: 350, stamp: "v1" }) });
      await story.push(FEATURE, SARA);
      await story.mergePullRequest({ number: 12, head: FEATURE, base: "main", author: SARA, by: OMAR, style: "merge" });
    },
    expect: CLEAN,
  },
];

runCatalog("What a merge brings", scenarios);
