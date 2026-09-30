/**
 * The reviewer must never be handed a cut it cannot see.
 *
 * This pins the defect that produced a live false accusation: a complete
 * 311-line C file reached the model as its first third, ending mid-identifier,
 * and the verdict came back "incomplete code — functions left hanging". The
 * model was not hallucinating; it described precisely what it had been shown.
 *
 * So the property under test is not "the prompt is short enough" but "the prompt
 * never lies about being whole".
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { CommitDetail, CommitFileChange } from "@/integrations/github/github.client.js";
import { buildReviewPrompt } from "@/modules/review/review.build.js";

const CUT = "اقتُطع الفرق";

function file(path: string, patch: string): CommitFileChange {
  return { path, additions: 1, deletions: 0, status: "added", patch };
}

function detail(files: CommitFileChange[]): CommitDetail {
  return { sha: "a".repeat(40), additions: 1, deletions: 0, files, parents: ["p0"], complete: true };
}

const promptFor = (files: CommitFileChange[]): string =>
  buildReviewPrompt({ title: "Add initial server implementation", authorLogin: "m7md-d", detail: detail(files) });

test("a patch that fits arrives whole and unmarked", () => {
  const patch = "+int main(void) { return 0; }";
  const prompt = promptFor([file("server.c", patch)]);

  assert.ok(prompt.includes(patch));
  assert.ok(!prompt.includes(CUT), "an uncut patch must not claim to be cut");
});

test("a patch past the per-file bound says so, with both numbers", () => {
  const patch = "+x".repeat(6_000); // 12,000 chars — four times the bound
  const prompt = promptFor([file("server.c", patch)]);

  assert.ok(prompt.includes(CUT), "the cut must be stated in the text the model reads");
  assert.ok(prompt.includes("3000"), "how much was shown");
  assert.ok(prompt.includes(String(patch.length)), "how much exists");
});

test("the running total cuts as invisibly as the per-file bound, so it is marked too", () => {
  // Five files of 3k each exhaust the 12k diff budget partway through the fourth.
  const files = ["a", "b", "c", "d", "e"].map((name) => file(`${name}.c`, "+y".repeat(1_500)));
  const prompt = promptFor(files);

  assert.ok(prompt.includes(CUT), "the file the budget ran out inside must say it was cut");
  assert.ok(prompt.includes("بقية الملفات محذوفة"), "and the files never reached must say so");
});

test("the real case: 8,933 characters shown as 3,000 is reported as a gap", () => {
  // The measurement from the live report, kept as the regression anchor.
  const patch = "+c".repeat(4_466) + "+";
  assert.equal(patch.length, 8_933);

  const prompt = promptFor([file("server.c", patch)]);
  const shown = prompt.indexOf(CUT);

  assert.ok(shown > 0);
  assert.ok(prompt.includes("8933"), "the model is told the file was three times what it saw");
});
