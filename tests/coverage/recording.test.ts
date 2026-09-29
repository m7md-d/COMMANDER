/**
 * Every judged push is recorded before anything decides not to send it — and
 * recorded once: a row that kept its judgement is only sent again.
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
  const withheld = code.indexOf("judgement.withheld");

  assert.ok(recorded !== -1 && withheld !== -1, `${PROCESSOR}: expected \`await record(\` and a read of \`judgement.withheld\` — if they were renamed, update this guard to the new names.`);
  assert.ok(
    recorded < withheld,
    `${PROCESSOR}: the withheld check comes before \`record(\`. Record first: silence means "do not send", never "do not remember" (0009 §5, docs/DEFECTS.md).`,
  );
});

test("the delivery processor sends a kept judgement before it judges anything", () => {
  const code = codeOnly(readFileSync(join(ROOT, PROCESSOR), "utf8"));
  const run = code.indexOf("async function run(");
  const kept = code.indexOf("readKeptReport(job.judgement)", run);
  const judged = code.indexOf("await judge(", run);

  assert.ok(run !== -1 && kept !== -1 && judged !== -1, `${PROCESSOR}: expected \`run\` to read \`readKeptReport(job.judgement)\` and call \`judge(\` — if they were renamed, update this guard to the new names.`);
  assert.ok(
    kept < judged,
    `${PROCESSOR}: \`run\` judges before it looks for a kept judgement. A retry or a resend must only write and send: judging again records the push twice (0012, D-31 in docs/DEFECTS.md).`,
  );
});

const DISPATCH = "apps/api/src/queue/delivery.dispatch.ts";

test("the dispatch asks whether the model wrote the report before it sends anything", () => {
  const code = codeOnly(readFileSync(join(ROOT, DISPATCH), "utf8"));
  const asked = code.indexOf("afterGeneration(");
  const sent = code.indexOf("sendEmbed(", code.indexOf("export async function deliver("));

  assert.ok(asked !== -1 && sent !== -1, `${DISPATCH}: expected \`afterGeneration(\` and \`sendEmbed(\` in \`deliver\` — if they were renamed, update this guard to the new names.`);
  assert.ok(
    asked < sent,
    `${DISPATCH}: \`deliver\` sends before asking \`afterGeneration\`. A report the model did not write is retried or held, never replaced by a sentence (0012).`,
  );
});
