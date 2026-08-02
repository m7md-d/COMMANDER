/**
 * The digest is what tells the reporter where code is supposed to live, so its
 * job is to preserve *shape* while discarding volume. These pin the parts that
 * would quietly mislead if they drifted: root files staying visible, truncation
 * staying declared, and counts reflecting files rather than paths walked.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeStructure } from "./structure.js";

const TREE = [
  "package.json",
  "README.md",
  "Dockerfile",
  "apps/api/src/main.ts",
  "apps/api/src/app.ts",
  "apps/web/src/main.tsx",
  "apps/web/src/App.tsx",
  "packages/shared/src/index.ts",
  "docs/DEPLOY.md",
];

test("areas are ranked by weight, so the biggest part of the project leads", () => {
  const digest = summarizeStructure(TREE);

  assert.equal(digest.areas[0]?.path, "apps");
  assert.equal(digest.areas[0]?.files, 4);
  assert.equal(digest.totalFiles, 9);
});

test("root-level files are an area of their own, not hidden under a directory", () => {
  const digest = summarizeStructure(TREE);
  const root = digest.areas.find((area) => area.path === "(root)");

  assert.equal(root?.files, 3);
});

test("stack markers are recognised at the root only", () => {
  const digest = summarizeStructure([...TREE, "apps/web/package.json"]);

  assert.deepEqual(digest.markers.sort(), ["Dockerfile", "README.md", "package.json"]);
});

test("extensions describe what kind of code this is", () => {
  const digest = summarizeStructure(TREE);

  assert.equal(digest.extensions[0]?.ext, ".ts");
  assert.equal(digest.extensions[0]?.files, 3);
});

test("a dotfile is not mistaken for an extension", () => {
  const digest = summarizeStructure([".gitignore", "src/a.ts"]);

  assert.deepEqual(digest.extensions, [{ ext: ".ts", files: 1 }]);
});

test("a capped listing declares itself, so counts are never read as totals", () => {
  assert.equal(summarizeStructure(TREE, true).truncated, true);
  assert.equal(summarizeStructure(TREE).truncated, false);
});
