/**
 * parseCommitReview is the seam between an unreliable model and a typed record.
 * Free-tier models wrap JSON in prose and code fences, omit optional fields, or
 * invent a verdict — each of those must resolve to either a clean review or a
 * clean null, never a throw and never a malformed object reaching the dossier.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCommitReview } from "./review.js";

test("extracts the JSON even when wrapped in prose and a code fence", () => {
  const raw =
    'إليك الحكم:\n```json\n{"verdict":"sloppy","remark":"دوال ضخمة","findings":["console.log منسي"]}\n```';
  const review = parseCommitReview(raw);

  assert.ok(review);
  assert.equal(review.verdict, "sloppy");
  assert.equal(review.remark, "دوال ضخمة");
  assert.deepEqual(review.findings, ["console.log منسي"]);
});

test("defaults a missing remark and findings rather than failing", () => {
  const review = parseCommitReview('{"verdict":"clean"}');

  assert.ok(review);
  assert.equal(review.remark, "");
  assert.deepEqual(review.findings, []);
});

test("rejects an unknown verdict", () => {
  assert.equal(parseCommitReview('{"verdict":"perfect","remark":"x"}'), null);
});

test("returns null when there is no JSON object at all", () => {
  assert.equal(parseCommitReview("عذراً، لا أستطيع الحكم."), null);
});
