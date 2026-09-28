/**
 * Every judged push is recorded before anything decides not to send it.
 *
 * `judgePush` no longer says whether to record (0009 §5): a judged push always
 * is, and `withheld` says only why the communiqué is not sent. What is left is
 * an order in the processor — `record(` before the `withheld` return — and the
 * processor does I/O, so no unit test calls it. Moved back above the record, the
 * skip silently drops the charges of every front with no channel and every
 * clean push of a silent one, and all the tests still pass: the scenario
 * reference mirrors the processor, it does not run it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { codeOnly, ROOT } from "../lib/sources.js";

const PROCESSOR = "apps/api/src/queue/delivery.processor.ts";

test("the delivery processor records a judged push before it withholds the communiqué", () => {
  const code = codeOnly(readFileSync(join(ROOT, PROCESSOR), "utf8"));
  const recorded = code.indexOf("await record(");
  const withheld = code.indexOf("judgement.withheld !== null");

  assert.ok(recorded !== -1 && withheld !== -1, `${PROCESSOR}: expected \`await record(\` and a \`judgement.withheld !== null\` check — if they were renamed, update this guard to the new names.`);
  assert.ok(
    recorded < withheld,
    `${PROCESSOR}: the withheld check comes before \`record(\`. Record first: silence means "do not send", never "do not remember" (0009 §5, docs/DEFECTS.md).`,
  );
});
