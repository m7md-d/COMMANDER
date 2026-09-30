/**
 * A line the merger wrote while resolving a conflict (D-25): in the merge's
 * version, in neither parent's.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { LandingSides } from "./landing.js";
import { resolutionsOf, writtenInResolution } from "./resolution.js";

const PATH = "src/core/m001.ts";
const sides = (merged: string): LandingSides => ({
  merge: "m",
  branch: [],
  fork: new Map([[PATH, "fork"]]),
  first: new Map([[PATH, "sum"]]),
  second: new Map([[PATH, "total"]]),
  merged: new Map([[PATH, merged]]),
});
const CONTENTS = new Map([
  ["sum", 'export const part1 = "sum";\n'],
  ["total", 'export const part1 = "total";\n'],
  ["took-total", 'export const part1 = "total";\n'],
  ["smuggled", 'export const part1 = "total";\nexport const skipAudit = true;\n'],
  ["kept-both", 'export const part1 = "sum";\n\nexport const part1 = "total";\n'],
]);

test("a line in neither parent's version is the merger's own", () => {
  assert.deepEqual(writtenInResolution(sides("smuggled"), CONTENTS), [PATH]);
});

test("a resolution that keeps one side's lines, or both, wrote nothing", () => {
  assert.deepEqual(writtenInResolution(sides("took-total"), CONTENTS), []);
  assert.deepEqual(writtenInResolution(sides("kept-both"), CONTENTS), [], "a blank line between them is not work");
});

test("a version not read names nothing", () => {
  assert.deepEqual(writtenInResolution(sides("smuggled"), new Map([...CONTENTS].filter(([sha]) => sha !== "sum"))), []);
});

test("only a file both sides changed, merged to neither side's version, is read", () => {
  assert.equal(resolutionsOf(sides("total")).length, 0, "the merge took the branch's version");
  const oneSide: LandingSides = { ...sides("smuggled"), first: new Map([[PATH, "fork"]]) };
  assert.equal(resolutionsOf(oneSide).length, 0, "main left it alone: mergeWork reads that");
  assert.deepEqual(resolutionsOf(sides("smuggled")).map((file) => file.path), [PATH]);
});
