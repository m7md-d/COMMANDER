import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Faces that carry Arabic, one for each platform the panel is opened on:
 * the project's own (when installed), Windows, macOS, Linux.
 */
const ARABIC_FACES = ["IBM Plex Sans Arabic", "Segoe UI", "Geeza Pro", "Noto Sans Arabic"];

test("Arabic in a monospaced field falls to a named Arabic face, not to the generic monospace (W-11)", () => {
  // No family in the mono stack carried Arabic, so each Arabic letter fell to
  // the generic `monospace` — Courier New on macOS, measured in Chrome — which
  // gives every letter the same width. The prompt editors, mostly Arabic, read
  // stretched letter by letter. A first fix put `system-ui` before the generic
  // one and this test passed, but Chrome still drew Courier New: system-ui is
  // not a fallback for glyphs it lacks. So the faces are named.
  const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
  const stack = /--font-mono:([^;]+);/.exec(tokens)?.[1] ?? "";
  const families = stack.split(",").map((family) => family.trim().replace(/"/g, ""));
  const generic = families.indexOf("monospace");

  assert.ok(generic !== -1, "the stack still ends in the generic monospace");
  for (const face of ARABIC_FACES) {
    const at = families.indexOf(face);
    assert.ok(at !== -1 && at < generic, `${face} comes before the generic monospace: ${families.join(", ")}`);
  }
});
