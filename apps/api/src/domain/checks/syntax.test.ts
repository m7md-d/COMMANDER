/**
 * What a real parser buys over counting braces, pinned as cases.
 *
 * Each of these is something the brace scanner got wrong or could not answer at
 * all — which is the whole argument for the dependency.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readSyntax } from "./syntax.js";

test("a function's length is measured from its first line to its last", () => {
  const source = "function a() {\n  const x = 1;\n  return x;\n}\n";

  assert.equal(readSyntax("a.ts", source).functionLines, 4);
});

test("the longest function wins, not the last one", () => {
  const source = "function a() {\n  return 1;\n}\nfunction b() {\n  const x = 1;\n  const y = 2;\n  return x + y;\n}\n";

  assert.equal(readSyntax("a.ts", source).functionLines, 5);
});

test("nesting counts blocks, not braces", () => {
  const source = "function a() {\n  if (x) {\n    while (y) {\n      z();\n    }\n  }\n}\n";

  assert.equal(readSyntax("a.ts", source).nestingDepth, 3);
});

/**
 * The case the brace counter systematically got wrong: an object literal is
 * braces and is not nesting, so a file full of config would score as deeply
 * nested code.
 */
test("an object literal is not nesting", () => {
  const source = "const config = {\n  a: { b: { c: { d: 1 } } },\n};\n";

  assert.equal(readSyntax("a.ts", source).nestingDepth, 0);
});

/**
 * And the one that made `.tsx` unusable: every JSX expression container is a
 * brace, so components scored two to three levels above equivalent logic.
 */
test("a JSX expression container is not nesting", () => {
  const source =
    "export function A() {\n  return <div className={x} onClick={() => y({ z: 1 })}>{items.map((i) => <b key={i}>{i}</b>)}</div>;\n}\n";
  const reading = readSyntax("a.tsx", source);

  // One block: the component's own body. The markup adds none.
  assert.equal(reading.nestingDepth, 1);
});

test("a class method is one level deeper than the same function free-standing", () => {
  const inClass = readSyntax("a.ts", "class A {\n  b() {\n    return 1;\n  }\n}\n");
  const free = readSyntax("a.ts", "function b() {\n  return 1;\n}\n");

  assert.equal(inClass.nestingDepth, 2);
  assert.equal(free.nestingDepth, 1);
});

/**
 * A syntax error is not measured. The parser recovers from damage and would hand
 * back a plausible tree, and a plausible tree is exactly what must not become a
 * number here.
 */
test("a file that does not parse is not measured", () => {
  const reading = readSyntax("a.ts", "function a( {\n  return;\n");

  assert.deepEqual(reading, { functionLines: null, nestingDepth: null });
});

test("a language the parser does not read is declined, not guessed at", () => {
  assert.deepEqual(readSyntax("a.py", "def f():\n    return 1\n"), {
    functionLines: null,
    nestingDepth: null,
  });
  assert.deepEqual(readSyntax("a.go", "func f() int { return 1 }\n"), {
    functionLines: null,
    nestingDepth: null,
  });
});

/** A regex holding an unmatched brace — the exact case that defeated the
 *  heuristic — is ordinary syntax to a parser. */
test("a regular expression literal is no longer a problem", () => {
  const source = "function a() {\n  const r = /[{]/;\n  return r;\n}\n";

  assert.equal(readSyntax("a.ts", source).nestingDepth, 1);
});
