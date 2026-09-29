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
import { codeOnly, isTest, ROOT, under } from "../lib/sources.js";

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

const DIGEST = "apps/api/src/queue/digest.processor.ts";

test("the weekly digest goes out on its facts when the model fails", () => {
  // It shares `deliver` with the push report, which holds a report the model did
  // not write (0012). The digest's facts are its report, so it says so — and
  // without this flag a 429 kept the whole week from the channel.
  const code = codeOnly(readFileSync(join(ROOT, DIGEST), "utf8"));

  assert.ok(
    code.includes("proseOptional: true"),
    `${DIGEST}: the composed digest no longer sets \`proseOptional: true\`. A failed generation must cost the digest its prose, not the week (afterGeneration).`,
  );
});

test("the test send queues a judgement of its own, so the sample is sent and never recorded", () => {
  // The sample push has made-up commits (aaaaaaa, bbbbbbb). Queued bare, the
  // worker judged it like a real push: asked GitHub for them (422 on each) and
  // wrote them and their charges into the record, against the front's first
  // member. Queued with a kept judgement, it only goes through `send` (0012).
  const offenders = under("apps/api/src/modules/")
    .filter((file) => !isTest(file) && file.text.includes("samplePush(") && file.text.includes("enqueue("))
    // The `enqueue(...)` statement, up to its semicolon, names `judgement`.
    .filter((file) => !/enqueue\([^;]*\bjudgement\b/.test(codeOnly(file.text)));

  assert.deepEqual(
    offenders.map((file) => file.path),
    [],
    "these queue the sample push without a kept judgement — the worker will judge and record made-up commits. Pass `judgement` to `enqueue` (docs/DEFECTS.md D-35).",
  );
});
