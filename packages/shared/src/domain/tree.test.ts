/**
 * The chart is read before it is opened, so what a collapsed directory claims
 * has to be true. These pin the claims that would mislead silently: an empty sum
 * never passing for a measured zero, a partial sum admitting it is partial, and
 * the order staying identical between two renders of the same snapshot.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTree, type TreeNode } from "./tree.js";
import { DEFAULT_CHECKS, resolveChecks } from "./checks.js";
import { inScope } from "./check-scope.js";
import type { TreeFile } from "../contracts/tree.js";

/** Nothing measured. Spread over, so a new metric does not break every case. */
const NO_READINGS: TreeFile["metrics"] = {
  file_lines: null,
  function_lines: null,
  nesting_depth: null,
  brace_depth: null,
  line_length: null,
};

/** A file with no readings at all, unless the case says otherwise. */
function file(path: string, over: Partial<TreeFile> & { lines?: number } = {}): TreeFile {
  const { lines, ...rest } = over;
  return {
    path,
    blobSha: `sha-${path}`,
    bytes: 100,
    metrics: { ...NO_READINGS, file_lines: lines ?? null },
    baseline: null,
    owners: [],
    lastTouchedAt: null,
    ...rest,
  };
}

/** The shipped limits with `file_lines` set to `limit`. */
function withLimit(limit: number) {
  return resolveChecks(null, { file_lines: { threshold: limit } });
}

function at(root: TreeNode, path: string): TreeNode {
  const found = path
    .split("/")
    .reduce<TreeNode | undefined>(
      (node, name) => node?.children.find((child) => child.name === name),
      root,
    );
  assert.ok(found, `expected a node at ${path}`);
  return found;
}

const TREE = [
  file("package.json", { bytes: 50 }),
  file("src/app.ts", { bytes: 200, lines: 120 }),
  file("src/core/log.ts", { bytes: 80, lines: 40 }),
  file("src/core/env.ts", { bytes: 60 }),
];

test("a directory carries the totals of everything beneath it", () => {
  const root = buildTree(TREE);
  const src = at(root, "src");

  assert.equal(src.totals.files, 3);
  assert.equal(src.totals.bytes, 340);
  assert.equal(root.totals.files, 4);
  assert.equal(root.totals.bytes, 390);
});

test("an unmeasured subtree reports zero measured, not zero lines", () => {
  const root = buildTree([file("src/a.ts"), file("src/b.ts")]);

  assert.equal(at(root, "src").totals.measured, 0);
  assert.equal(at(root, "src").totals.lines, 0);
});

test("a partly measured subtree admits the sum is a floor", () => {
  const core = at(buildTree(TREE), "src/core");

  assert.equal(core.totals.files, 2);
  assert.equal(core.totals.measured, 1);
  assert.equal(core.totals.lines, 40);
});

test("directories sort before files, and each group by name", () => {
  const root = buildTree([file("z.ts"), file("a.ts"), file("src/x.ts"), file("lib/y.ts")]);

  assert.deepEqual(
    root.children.map((node) => node.name),
    ["lib", "src", "a.ts", "z.ts"],
  );
});

test("the top owner of a directory is summed across it, not taken from one file", () => {
  const root = buildTree([
    file("src/a.ts", { owners: [{ login: "amal", displayName: "Amal", linesAdded: 90, commitCount: 2 }] }),
    file("src/b.ts", { owners: [{ login: "sami", displayName: "Sami", linesAdded: 50, commitCount: 1 }] }),
    file("src/c.ts", { owners: [{ login: "sami", displayName: "Sami", linesAdded: 60, commitCount: 1 }] }),
  ]);

  // Amal leads any single file she touched; Sami leads the directory.
  assert.equal(at(root, "src/a.ts").totals.topOwner, "amal");
  assert.equal(at(root, "src").totals.topOwner, "sami");
});

test("the latest touch wins the rollup", () => {
  const root = buildTree([
    file("src/a.ts", { lastTouchedAt: "2026-01-05T00:00:00.000Z" }),
    file("src/b.ts", { lastTouchedAt: "2026-03-09T00:00:00.000Z" }),
    file("src/c.ts"),
  ]);

  assert.equal(at(root, "src").totals.lastTouchedAt, "2026-03-09T00:00:00.000Z");
});

test("a root-level file is a root node, not wrapped in a directory", () => {
  const root = buildTree(TREE);
  const manifest = at(root, "package.json");

  assert.equal(manifest.kind, "file");
  assert.equal(manifest.file?.blobSha, "sha-package.json");
});

test("the same snapshot builds the same chart whatever order the rows arrive in", () => {
  const forward = buildTree(TREE);
  const backward = buildTree([...TREE].reverse());

  assert.deepEqual(forward, backward);
});

/**
 * The count a collapsed directory reports is state, not blame: it says how much
 * of the problem is inside without claiming anyone put it there.
 */
test("a directory counts the measured files standing over the limit", () => {
  const root = buildTree(
    [
      file("src/big.ts", { lines: 260 }),
      file("src/small.ts", { lines: 40 }),
      file("src/core/huge.ts", { lines: 900 }),
    ],
    withLimit(200),
  );

  assert.equal(at(root, "src").totals.over, 2);
  assert.equal(at(root, "src/core").totals.over, 1);
});

test("an unmeasured file is not counted as over — unknown is not a verdict", () => {
  const root = buildTree([file("src/a.ts"), file("src/b.ts", { lines: 900 })], withLimit(200));

  assert.equal(at(root, "src").totals.over, 1);
  assert.equal(at(root, "src").totals.measured, 1);
});

test("exactly at the limit is within it, here as in the judgement", () => {
  const root = buildTree([file("src/a.ts", { lines: 200 })], withLimit(200));

  assert.equal(at(root, "src").totals.over, 0);
});

/**
 * Any limit, not all of them: one metric crossed is a file worth looking at, and
 * a directory reporting "clear" because two of three were fine would be
 * reassuring about the wrong thing.
 */
test("a file over any single limit counts as over", () => {
  const deep = file("src/deep.ts");
  deep.metrics = { ...NO_READINGS, file_lines: 10, nesting_depth: 9 };

  assert.equal(buildTree([deep]).totals.over, 1);
});

test("a metric switched off cannot put a file over", () => {
  const long = file("src/long.ts");
  long.metrics = { ...NO_READINGS, file_lines: 10, line_length: 400 };

  // line_length ships disabled, so a 400-character line is not a finding here.
  assert.equal(buildTree([long]).totals.over, 0);
  assert.equal(
    buildTree([long], resolveChecks(null, { line_length: { enabled: true } })).totals.over,
    1,
  );
});

test("a metric that does not claim the path cannot put it over", () => {
  const styles = file("src/a.css");
  styles.metrics = { ...NO_READINGS, file_lines: 10, brace_depth: 9 };

  // brace_depth excludes stylesheets: braces there are selectors, not blocks.
  assert.equal(buildTree([styles]).totals.over, 0);
});

/**
 * The two depth metrics must never both claim a file. They are measured by
 * different means — a parser and a brace counter — and a file scored twice could
 * be charged twice for one structure, on numbers that disagree.
 */
test("the parsed and heuristic depth metrics never overlap", () => {
  for (const path of ["src/a.ts", "src/a.tsx", "src/a.js", "src/a.java", "src/a.go"]) {
    const claimed = ["nesting_depth", "brace_depth"].filter((metric) =>
      inScope(DEFAULT_CHECKS[metric as "nesting_depth" | "brace_depth"], path),
    );
    assert.ok(claimed.length <= 1, `${path} is claimed by ${claimed.join(" and ")}`);
  }
});
