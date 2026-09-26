/**
 * The size rules judge what a push brought, not what it carries.
 *
 * Written from a live complaint: every merge to the trunk was charged as the
 * largest event in the repository's history, because the branch's own files were
 * counted once in its commits and again in the merge commit's aggregate stacked
 * on top. The report then repeated work it had already reported when the branch
 * was pushed.
 *
 * The residue rule is the reason this was fixed by re-weighing rather than by
 * ignoring merges outright: a merge that is not looked at is exactly where
 * something unreviewed can be parked.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedCommit, PushWeight, RuleConfigBase, ThresholdRuleConfig } from "@commander/shared";
import { batchDumpRule } from "@/domain/violations/rules/batch-dump.rule.js";
import { largeDiffRule } from "@/domain/violations/rules/large-diff.rule.js";
import { mergeResidueRule } from "@/domain/violations/rules/merge-residue.rule.js";
import type { RuleContext } from "@/domain/violations/types.js";

const THRESHOLD: ThresholdRuleConfig = { enabled: true, threshold: 5 };
const ON: RuleConfigBase = { enabled: true };

/** The rules under test read `weight` and the commits under judgement, so the push may stay empty. */
function context(weight: Partial<PushWeight>, commits: NormalizedCommit[] = []): RuleContext {
  return {
    push: {
      repoFullName: "team/repo",
      repoUrl: "",
      branch: "main",
      ref: "refs/heads/main",
      forced: false,
      created: false,
      deleted: false,
      compareUrl: "",
      actorLogin: "ahmad",
      actorAvatarUrl: "",
      commits: [],
      truncated: false,
    },
    kind: "direct_push",
    trunk: true,
    timezoneOffset: 3,
    weight: { newCommits: 0, filesTouched: 0, work: [], measured: true, ...weight },
    commits,
    landed: [],
  };
}

/** A merge commit by `author`, for the residue rule to find among the commits it judges. */
function merge(sha: string, author = "omar"): NormalizedCommit {
  return {
    sha,
    title: "Integrate the export feature",
    url: "",
    timestamp: "2026-08-10T10:00:00+03:00",
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 0,
    authorLogin: author,
    committerLogin: author,
    parents: ["p0", "p1"],
  };
}

test("a merge that re-delivers recorded work is charged for neither size", () => {
  // Twelve commits and forty files arrived, all of them already reported.
  const merge = context({ newCommits: 1, filesTouched: 0 });

  assert.equal(batchDumpRule(merge, THRESHOLD), null);
  assert.equal(largeDiffRule(merge, THRESHOLD), null);
});

test("genuinely new work is charged exactly as before", () => {
  const busy = context({ newCommits: 9, filesTouched: 31 });

  assert.deepEqual(batchDumpRule(busy, THRESHOLD), { count: 9, threshold: 5 });
  assert.deepEqual(largeDiffRule(busy, { enabled: true, threshold: 30 }), {
    count: 31,
    threshold: 30,
  });
});

test("a merge's residue is charged to the merge, at its real size", () => {
  const smuggled = context(
    { newCommits: 1, filesTouched: 1, work: [{ sha: "m", paths: ["src/auth.ts"] }] },
    [merge("m")],
  );

  assert.deepEqual(mergeResidueRule(smuggled, ON), { files: 1 });
  // One file is not a large diff, and must not be dressed up as one.
  assert.equal(largeDiffRule(smuggled, THRESHOLD), null);
});

test("a clean merge leaves no residue and says nothing", () => {
  assert.equal(mergeResidueRule(context({ newCommits: 1, work: [{ sha: "m", paths: [] }] }, [merge("m")]), ON), null);
});

test("the residue judged is the merges under judgement: one author's, not the push's", () => {
  // Lina's merge carries the residue; Omar's is clean. Judging Omar's work finds nothing of Lina's.
  const work = [
    { sha: "lina-merge", paths: ["src/auth.ts"] },
    { sha: "omar-merge", paths: [] },
  ];

  assert.equal(mergeResidueRule(context({ work }, [merge("omar-merge")]), ON), null);
  assert.deepEqual(mergeResidueRule(context({ work }, [merge("lina-merge", "lina")]), ON), { files: 1 });
});

test("an unmeasured push is never accused of smuggling", () => {
  // Truncated payload, missing branch head, or no enrichment: no work to read,
  // and unmeasured. Firing here would charge an honest merge for a whole branch.
  const blind = context({ newCommits: 3, filesTouched: 12, measured: false }, [merge("m")]);

  assert.equal(mergeResidueRule(blind, ON), null);
  // The size rules still work off the pre-existing counts, so nothing regresses.
  assert.deepEqual(largeDiffRule(blind, THRESHOLD), { count: 12, threshold: 5 });
});
