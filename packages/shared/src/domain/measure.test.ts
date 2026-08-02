/**
 * A wrong number here becomes a violation recorded against a person, so the
 * cases that matter most are the ones where the scanner is *fooled*: it has to
 * notice and return null rather than a confident wrong depth.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { countLines, longestLineLength, measureContent, scanBraces } from "./measure.js";

test("a trailing newline does not invent a line, and its absence does not lose one", () => {
  assert.equal(countLines("a\nb\nc\n"), 3);
  assert.equal(countLines("a\nb\nc"), 3);
});

test("an empty file is zero lines, and a single newline is one", () => {
  assert.equal(countLines(""), 0);
  assert.equal(countLines("\n"), 1);
});

test("blank lines count — they are lines somebody has to scroll past", () => {
  assert.equal(countLines("a\n\n\nb\n"), 4);
});

/* ---------- longest line ---------- */

test("the longest line is measured in characters, ignoring the newline", () => {
  assert.equal(longestLineLength("ab\nabcd\nabc"), 4);
});

test("a windows line ending is not a character anybody sees", () => {
  assert.equal(longestLineLength("abcd\r\nab"), 4);
});

test("an empty file has no longest line", () => {
  assert.equal(longestLineLength(""), 0);
});

/* ---------- brace depth ---------- */

test("depth counts nesting, not braces", () => {
  assert.equal(scanBraces("function a() { if (b) { while (c) { d(); } } }"), 3);
  assert.equal(scanBraces("a() {} b() {} c() {}"), 1);
});

test("a file with no braces at all measures zero, which is not null", () => {
  assert.equal(scanBraces("x = 1\ny = 2\n"), 0);
});

test("braces inside comments are not code", () => {
  assert.equal(scanBraces("// { { {\nf() { }\n/* } } } */"), 1);
});

test("braces inside strings are not code, in any quote", () => {
  assert.equal(scanBraces('f() { const a = "{{{"; }'), 1);
  assert.equal(scanBraces("f() { const a = '}}}'; }"), 1);
});

test("an escaped quote does not end the string it sits in", () => {
  assert.equal(scanBraces('f() { const a = "he said \\" { \\" here"; }'), 1);
});

/**
 * A template interpolation is an expression, not a block. Reading it as part of
 * the string under-counts nothing that matters and can never over-count.
 */
test("a template interpolation does not add depth", () => {
  assert.equal(scanBraces("f() { const a = `x ${ y } z`; }"), 1);
});

/**
 * The balance check earning its place. Each of these is a construct the scanner
 * does not model, and in every one it has to answer "I could not read this"
 * rather than a number.
 */
test("a brace the scanner cannot account for yields null, never a guess", () => {
  // A regex literal holding an unmatched brace.
  assert.equal(scanBraces("f() { const r = /[{]/; }"), null);
  // A stray closing brace with nothing open.
  assert.equal(scanBraces("}\n"), null);
  // A block left open at the end of the file.
  assert.equal(scanBraces("f() { g() {\n"), null);
  // A single-quoted string that never closes on its line.
  assert.equal(scanBraces("f() { const a = 'oops\n }"), null);
});

test("a language without braces measures zero rather than lying about depth", () => {
  assert.equal(scanBraces("def f():\n    if x:\n        return 1\n"), 0);
});

test("all three readings come from one pass over the same content", () => {
  const measured = measureContent("f() {\n  g();\n}\n");

  assert.deepEqual(measured, { lines: 3, braceDepth: 1, longestLine: 6 });
});
