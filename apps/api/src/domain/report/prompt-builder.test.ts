/**
 * The commit block is what the model reports on, so a lie here becomes a lie in
 * the communiqué. This pins the regression that produced "صفر أسطر مضافة" for a
 * 674-line commit: unmeasured line counts must be *absent*, never zero, and the
 * file count must never be phrased as a line count.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedCommit, NormalizedPush } from "@commander/shared";
import { buildPromptValues, praiseLabel, violationLabel } from "@/domain/report/prompt-builder.js";
import { renderUserPrompt } from "@/domain/report/prompt-render.js";

function commit(overrides: Partial<NormalizedCommit> = {}): NormalizedCommit {
  return {
    sha: "a".repeat(40),
    title: "add .env.example",
    url: "",
    timestamp: "2026-07-25T14:46:47Z",
    filesAdded: 1,
    filesRemoved: 0,
    filesModified: 0,
    authorLogin: "m7md-d",
    committerLogin: "m7md-d",
    ...overrides,
  };
}

function push(commits: NormalizedCommit[]): NormalizedPush {
  return {
    repoFullName: "m7md-d/COMMANDER",
    repoUrl: "",
    branch: "main",
    ref: "refs/heads/main",
    forced: false,
    created: false,
    deleted: false,
    compareUrl: "",
    actorLogin: "m7md-d",
    actorAvatarUrl: "",
    commits,
    truncated: false,
  };
}

const BASE = {
  member: null,
  violations: [],
  commendations: [],
  history: { totalCommits: 2, totalPushes: 1, violationCounts: {} },
  project: { brief: "", stage: "active" as const, constitution: null, structure: null },
  reviews: [],
  gravity: "routine" as const,
  options: {
    locale: "ar" as const,
    maxWords: 120,
    quoteMaxLength: 120,
    injectionGuard: true,
    now: new Date("2026-07-25T21:30:00Z"),
    timezoneOffset: 3,
  },
};

test("an enriched commit states its real line counts", () => {
  const values = buildPromptValues({
    ...BASE,
    push: push([commit({ additions: 79, deletions: 0 })]),
  });

  assert.match(String(values.commits), /79/);
  assert.match(String(values.commits), /1 ملف/);
});

test("an unenriched commit says the line count is unavailable, never zero", () => {
  const values = buildPromptValues({ ...BASE, push: push([commit()]) });
  const block = String(values.commits);

  // The old template rendered "0 إضافة / 0 حذف / 0 تعديل", which the model read
  // as "zero lines changed" for a commit that added 674 of them.
  assert.doesNotMatch(block, /\+0|0 سطر/);
  assert.match(block, /غير متاح/);
});

test("a zero-line commit is reported as zero only when it was actually measured", () => {
  const values = buildPromptValues({
    ...BASE,
    push: push([commit({ additions: 0, deletions: 0 })]),
  });

  assert.match(String(values.commits), /\+0/);
});

test("the date is the operator's local calendar day, not the model's guess", () => {
  // 21:30 UTC in a +3 zone is already the 26th locally.
  const values = buildPromptValues({ ...BASE, push: push([commit()]) });

  assert.equal(values.today, "2026-07-26");
});

test("stage decides what the model is told to expect", () => {
  const bootstrap = buildPromptValues({
    ...BASE,
    project: { ...BASE.project, stage: "bootstrap" },
    push: push([commit()]),
  });
  const frozen = buildPromptValues({
    ...BASE,
    project: { ...BASE.project, stage: "frozen" },
    push: push([commit()]),
  });

  // The whole point of the stage: identical work, opposite expectations.
  assert.notEqual(bootstrap.stageGuidance, frozen.stageGuidance);
  assert.match(String(bootstrap.stageGuidance), /السقالات/);
  assert.match(String(frozen.stageGuidance), /تبرير/);
});

test("a missing rules file is stated, never left blank for the model to fill", () => {
  const values = buildPromptValues({ ...BASE, push: push([commit()]) });

  assert.match(String(values.constitution), /لم يُعثر/);
  assert.match(String(values.projectBrief), /بلا تعريف/);
});

test("an unscanned project says so instead of implying an empty repository", () => {
  const values = buildPromptValues({ ...BASE, push: push([commit()]) });

  assert.match(String(values.structure), /لم تُفحص/);
});

test("a scanned layout reaches the prompt as shape, not as a file listing", () => {
  const values = buildPromptValues({
    ...BASE,
    push: push([commit()]),
    project: {
      ...BASE.project,
      structure: {
        areas: [{ path: "apps", files: 120 }],
        extensions: [{ ext: ".ts", files: 90 }],
        markers: ["package.json"],
        totalFiles: 140,
        truncated: false,
      },
    },
  });

  const block = String(values.structure);
  assert.match(block, /apps \(120\)/);
  assert.match(block, /package\.json/);
  assert.match(block, /140/);
});

test("a template written before stages existed still receives the context", () => {
  const values = buildPromptValues({
    ...BASE,
    project: { ...BASE.project, stage: "bootstrap" },
    push: push([commit()]),
  });

  // The prompt stored in a live database predates these variables entirely.
  const prompt = renderUserPrompt("الريبو: {{repo}}\nالفرع: {{branch}}", values);

  assert.match(prompt, /السقالات/);
  assert.match(prompt, /2026-07-26/);
  assert.match(prompt, /الفرع: main/);
});

test("a template that places the context itself is left alone", () => {
  const values = buildPromptValues({ ...BASE, push: push([commit()]) });
  const prompt = renderUserPrompt("مرحلة: {{stageGuidance}}", values);

  // No duplicated block: the operator asked for it, so they own the placement.
  assert.doesNotMatch(prompt, /تاريخ اليوم/);
});

test("a clean push is handed praise instructions, not a licence to invent faults", () => {
  const values = buildPromptValues({ ...BASE, push: push([commit()]) });

  assert.match(String(values.tone), /ابدأ بالثناء/);
});

test("the register hardens with repetition of the same rule", () => {
  const once = buildPromptValues({
    ...BASE,
    violations: [{ ruleId: "weekend_ops", detail: {} }],
    history: { ...BASE.history, violationCounts: { weekend_ops: 1 } },
    push: push([commit()]),
  });
  const chronic = buildPromptValues({
    ...BASE,
    violations: [{ ruleId: "weekend_ops", detail: {} }],
    history: { ...BASE.history, violationCounts: { weekend_ops: 12 } },
    push: push([commit()]),
  });

  assert.match(String(once.tone), /اغسلها/);
  assert.match(String(chronic.tone), /12/);
  assert.notEqual(once.tone, chronic.tone);
});

test("a critical branch is named to the model and hardens the register", () => {
  const slip = {
    ...BASE,
    violations: [{ ruleId: "weekend_ops" as const, detail: {} }],
    history: { ...BASE.history, violationCounts: { weekend_ops: 1 } },
    push: push([commit()]),
  };

  const routine = buildPromptValues(slip);
  const critical = buildPromptValues({ ...slip, gravity: "critical" });

  assert.match(String(critical.branchGravity), /حرِج/);
  assert.match(String(critical.branchGravity), /main/);
  // Same act, same depth of examination — only the register moved.
  assert.match(String(routine.tone), /اغسلها/);
  assert.notEqual(routine.tone, critical.tone);
});

test("code verdicts reach the prompt; their absence is stated, not implied clean", () => {
  const withReview = buildPromptValues({
    ...BASE,
    push: push([commit()]),
    reviews: [
      { title: "add .env.example", verdict: "clean", remark: "موثّق بدقة", findings: ["تغطية شاملة"] },
    ],
  });
  const without = buildPromptValues({ ...BASE, push: push([commit()]) });

  assert.match(String(withReview.codeReview), /موثّق بدقة/);
  assert.match(String(withReview.codeReview), /تغطية شاملة/);
  assert.match(String(without.codeReview), /لا مراجعة كود/);
});

test("the rules document is clamped so it cannot crowd out the diff", () => {
  const values = buildPromptValues({
    ...BASE,
    project: { ...BASE.project, constitution: "ب".repeat(9_000) },
    push: push([commit()]),
  });

  assert.ok(String(values.constitution).length < 2_100);
});

/**
 * The label picks a sentence from what the detail actually carries. A check on
 * a file that did not exist has no `before`; an engagement rule never had one to
 * begin with, and must not be sent down the same branch — `rule.large_diff.
 * reportNew` does not exist, and asking for it would print the key itself into
 * a communiqué.
 */
test("a check on a new file takes the sentence that claims no before", () => {
  const label = violationLabel("ar", {
    ruleId: "file_lines",
    detail: { path: "src/a.ts", after: 210, threshold: 200 },
  });

  assert.match(label, /أنشأ/);
  assert.doesNotMatch(label, /reportNew|\{/, "the key itself must never reach the reader");
});

test("an engagement rule keeps its own sentence, having never had a before", () => {
  const label = violationLabel("ar", {
    ruleId: "large_diff",
    detail: { count: 40, threshold: 20 },
  });

  assert.match(label, /40/);
  assert.doesNotMatch(label, /rule\.large_diff/, "no missing-key passthrough");
});

test("a credit reads as an improvement, with the numbers that prove it", () => {
  const label = praiseLabel("ar", {
    ruleId: "file_lines",
    detail: { path: "src/a.ts", before: 400, after: 350, threshold: 200 },
  });

  assert.match(label, /400/);
  assert.match(label, /350/);
});

test("praise reaches a template written before praise existed", () => {
  const values = buildPromptValues({
    ...BASE,
    commendations: [
      { ruleId: "file_lines", detail: { path: "src/a.ts", before: 400, after: 350, threshold: 200 } },
    ],
    push: push([commit()]),
  });

  // A stored prompt that names none of the new variables still carries the block.
  const rendered = renderUserPrompt("الريبو: {{repo}}", values);
  assert.match(rendered, /350/);

  // And a template that places it itself is not given a second copy.
  const placed = renderUserPrompt("{{commendations}}", values);
  assert.equal(placed.match(/350/g)?.length, 1);
});

test("a push with nothing earned adds nothing to the prompt", () => {
  const values = buildPromptValues({ ...BASE, push: push([commit()]) });
  const rendered = renderUserPrompt("الريبو: {{repo}}", values);

  assert.equal(String(values.commendations), "", "silence, not 'nobody improved anything'");
  assert.doesNotMatch(rendered, /استُحقّ عليه المدح/, "no empty heading in the prompt");
});
