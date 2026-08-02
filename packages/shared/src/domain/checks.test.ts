/**
 * The crossing rule is the whole ethic of the checks system, so its deceptive
 * cases are the ones pinned hardest: inheriting a mess is not committing one,
 * and shrinking a file that stays over the limit is still an improvement.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CHECKS, judgeCheck, resolveChecks } from "./checks.js";
import { inScope, matchesGlob } from "./check-scope.js";

const LIMIT = 200;

function verdict(before: number | null, after: number, touched = true) {
  return judgeCheck({ before, after, threshold: LIMIT, touched });
}

test("pushing a file past the limit is the violation", () => {
  assert.equal(verdict(190, 210), "crossed");
});

test("a file created over the limit crossed it — nobody inherits what did not exist", () => {
  assert.equal(verdict(null, 210), "crossed");
});

test("growing a file that was already over the limit is not a crossing", () => {
  assert.equal(verdict(400, 405), "worsened");
});

test("shrinking a file is an improvement even while it stays over the limit", () => {
  assert.equal(verdict(400, 350), "improved");
});

test("bringing a file back under the limit is an improvement", () => {
  assert.equal(verdict(210, 190), "improved");
});

test("ordinary work under the limit says nothing", () => {
  assert.equal(verdict(100, 120), "none");
  assert.equal(verdict(null, 40), "none");
});

test("an over-limit file whose count did not move has nothing to answer for", () => {
  assert.equal(verdict(400, 400), "none");
});

test("an untouched file over the limit is inherited, not charged to anyone", () => {
  assert.equal(verdict(null, 400, false), "inherited");
  assert.equal(verdict(400, 400, false), "inherited");
});

test("exactly at the limit is within it", () => {
  assert.equal(verdict(150, 200), "none");
  assert.equal(verdict(200, 201), "crossed");
});

/* ---------- scope ---------- */

test("a star stays inside one segment, a double star crosses them", () => {
  assert.equal(matchesGlob("src/*.ts", "src/app.ts"), true);
  assert.equal(matchesGlob("src/*.ts", "src/core/app.ts"), false);
  assert.equal(matchesGlob("src/**/*.ts", "src/core/deep/app.ts"), true);
});

test("a leading double star matches no directories at all, which is what it means", () => {
  assert.equal(matchesGlob("**/*.ts", "app.ts"), true);
  assert.equal(matchesGlob("**/*.ts", "src/core/app.ts"), true);
});

test("a dot in a pattern is a dot, not any character", () => {
  assert.equal(matchesGlob("**/*.ts", "srcXts"), false);
  assert.equal(matchesGlob("a.ts", "axts"), false);
});

test("source is measured and generated output is not", () => {
  const scope = DEFAULT_CHECKS.file_lines;

  assert.equal(inScope(scope, "apps/api/src/app.ts"), true);
  assert.equal(inScope(scope, "apps/web/src/styles/tokens.css"), true);
  assert.equal(inScope(scope, "node_modules/react/index.js"), false);
  assert.equal(inScope(scope, "apps/web/dist/assets/index.js"), false);
  assert.equal(inScope(scope, "packages/shared/dist/index.d.ts"), false);
});

test("what is not source is simply out of scope, never measured as zero", () => {
  const scope = DEFAULT_CHECKS.file_lines;

  assert.equal(inScope(scope, "LICENSE"), false);
  assert.equal(inScope(scope, "docs/DEPLOY.md"), false);
  assert.equal(inScope(scope, "assets/logo.png"), false);
});

/* ---------- three-layer resolution ---------- */

test("a front inherits the shipped defaults when nothing overrides them", () => {
  assert.deepEqual(resolveChecks(null, null), DEFAULT_CHECKS);
});

test("a template overrides the defaults, and a front overrides the template", () => {
  const resolved = resolveChecks(
    { file_lines: { threshold: 300 } },
    { file_lines: { threshold: 500 } },
  );

  assert.equal(resolved.file_lines.threshold, 500);
});

/**
 * The one that would break silently: overriding a threshold must not discard the
 * scope the template defined, or the check starts judging generated files and
 * looks like a bug in the metric rather than in the merge.
 */
test("overriding one field leaves the rest of the layer beneath it standing", () => {
  const template = { file_lines: { threshold: 300, exclude: ["**/legacy/**"] } };
  const resolved = resolveChecks(template, { file_lines: { threshold: 500 } });

  assert.equal(resolved.file_lines.threshold, 500);
  assert.deepEqual(resolved.file_lines.exclude, ["**/legacy/**"]);
  assert.deepEqual(resolved.file_lines.include, DEFAULT_CHECKS.file_lines.include);
});

test("a metric can be switched off at either layer, and back on by the front", () => {
  assert.equal(resolveChecks({ file_lines: { enabled: false } }, null).file_lines.enabled, false);
  assert.equal(resolveChecks(null, { file_lines: { enabled: false } }).file_lines.enabled, false);
  assert.equal(
    resolveChecks({ file_lines: { enabled: false } }, { file_lines: { enabled: true } }).file_lines
      .enabled,
    true,
  );
});
