import { test } from "node:test";
import assert from "node:assert/strict";
import { markerFingerprint, readMarkers } from "./markers.js";

test("a marker is found with its kind, line and text", () => {
  const found = readMarkers("const a = 1;\n// TODO: split this file\nconst b = 2;\n");

  assert.deepEqual(found, [{ kind: "TODO", line: 2, text: "split this file" }]);
});

test("every kind is recognised, and the separator is optional", () => {
  const found = readMarkers("// FIXME retry path\n/* HACK - works for now */\n# XXX\n");

  assert.deepEqual(
    found.map((marker) => marker.kind),
    ["FIXME", "HACK", "XXX"],
  );
  assert.equal(found[2]?.text, "", "a bare marker has no text, not a fabricated one");
});

test("lowercase prose and identifiers are not markers", () => {
  // The whole index is worthless if `todos.length` and "todo list" fill it.
  const found = readMarkers("const todos = [];\n// the todo list is long\nfixmeLater();\n");

  assert.deepEqual(found, []);
});

test("the note is clamped, not dropped", () => {
  const found = readMarkers(`// TODO: ${"x".repeat(400)}`);

  assert.equal(found.length, 1);
  assert.ok((found[0]?.text.length ?? 0) <= 140);
});

test("a file of nothing but markers is capped", () => {
  const found = readMarkers(Array.from({ length: 60 }, (_, i) => `// TODO: ${i}`).join("\n"));

  assert.equal(found.length, 20, "past this the file is the finding, not any one note");
});

test("a file with no markers reads as empty, which is not the same as unscanned", () => {
  assert.deepEqual(readMarkers("const a = 1;\n"), []);
});

test("the fingerprint ignores the line, so a note that moves keeps its age", () => {
  const before = markerFingerprint("src/a.ts", "split this file");
  const after = markerFingerprint("src/a.ts", "  Split This File  ");

  assert.equal(before, after, "case and padding are not edits to the note");
});

test("the same note in two files is two notes", () => {
  assert.notEqual(markerFingerprint("src/a.ts", "fix"), markerFingerprint("src/b.ts", "fix"));
});
