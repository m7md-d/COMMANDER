import assert from "node:assert/strict";
import { test } from "node:test";
import { translateFrom } from "./types.js";
import { AR } from "./ar.js";

const TABLE = { "hello.name": "أهلاً {name}", "plain": "ثابت" };

test("translateFrom: one dictionary, its variables filled, and an unknown placeholder left visible", () => {
  assert.equal(translateFrom(TABLE, "hello.name", { name: "سارة" }), "أهلاً سارة");
  assert.equal(translateFrom(TABLE, "hello.name", {}), "أهلاً {name}");
  assert.equal(translateFrom(TABLE, "plain"), "ثابت");
});

test("translateFrom: a key the table does not hold reads as the key — greppable, never undefined", () => {
  assert.equal(translateFrom(TABLE, "missing.key"), "missing.key");
});

/**
 * A Latin run inside an Arabic sentence that starts or ends with punctuation —
 * `.env`, `release/*`, `/settings/installations/<id>` — has that punctuation
 * pulled to the Arabic side by the bidi algorithm: the panel showed `env.` and
 * `*\/release` (docs/UI-DEFECTS.md W-05). Such a run is wrapped in LRI…PDI
 * (U+2066…U+2069), or preceded by an LRM as `‎:free` already was. Keys the model
 * reads and no screen shows are left alone: an invisible mark is noise to it.
 */
const MODEL_ONLY = /^(report|digest|assess)\./;

function unisolatedRuns(value: string): string[] {
  const outside = value.replace(/⁦[^⁩]*⁩/g, " ");
  const tokens = outside.split(/\s+/).filter((token) => /[A-Za-z]/.test(token));
  const edged = tokens.filter((token) => /^[./:-]+[A-Za-z]/.test(token) || /[A-Za-z0-9][*/>]+[.،)]?$/.test(token));
  const arrows = /[A-Za-z]\s*[←→]\s*[A-Za-z]/.test(outside) ? ["an arrow between Latin words"] : [];
  return [...edged, ...arrows];
}

test("Arabic screen text isolates every Latin run its punctuation would flip (W-05)", () => {
  const found = Object.entries(AR)
    .filter(([key, value]) => !MODEL_ONLY.test(key) && /[؀-ۿ]/.test(value))
    .map(([key, value]) => ({ key, runs: unisolatedRuns(value) }))
    .filter((entry) => entry.runs.length > 0)
    .map((entry) => `${entry.key}: ${entry.runs.join(" · ")}`);

  assert.deepEqual(found, [], "wrap each run in \\u2066…\\u2069 in ar.ts");
});
