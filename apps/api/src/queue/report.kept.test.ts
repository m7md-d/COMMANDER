/**
 * The judgement a delivery keeps (0012), read back. A retry and the resend
 * button send from it and never judge again; a row whose kept judgement cannot
 * be read must read as none, so it is never sent from a guess.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@prisma/client";
import type { NormalizedPush } from "@commander/shared";
import { judgementOf, keptReport, readKeptReport } from "@/queue/report.kept.js";

const PUSH: NormalizedPush = {
  repoFullName: "team/repo",
  repoUrl: "",
  branch: "main",
  ref: "refs/heads/main",
  forced: false,
  created: false,
  deleted: false,
  compareUrl: "",
  actorLogin: "sara",
  actorAvatarUrl: "",
  commits: [],
  truncated: false,
};

const KEPT = keptReport({
  push: PUSH,
  judgement: {
    event: { kind: "direct_push", pull: null },
    mainLine: true,
    violations: [{ ruleId: "direct_push", login: "sara", detail: { count: 1 } }],
    commendations: [{ ruleId: "file_lines", login: "lina", detail: { before: 210, after: 190 } }],
    fresh: PUSH.commits.map((commit) => commit.sha),
  },
  history: { totalCommits: 3, totalPushes: 2, violationCounts: { direct_push: 1 } },
});

/** A value as a Json column gives it back. */
const stored = (value: unknown): Prisma.JsonValue => JSON.parse(JSON.stringify(value));

test("a kept report reads back as it was written", () => {
  assert.deepEqual(readKeptReport(stored(KEPT)), KEPT);
  assert.equal(KEPT.rewrites, null, "a first report rewrites nothing");
});

test("a row from before 0012, or one that cannot be read, has no kept report", () => {
  assert.equal(readKeptReport(null), null);
  assert.equal(readKeptReport(stored({ push: PUSH })), null, "no version");
  assert.equal(readKeptReport(stored({ ...KEPT, version: 2 })), null, "a shape this code does not know");
  assert.equal(readKeptReport(stored({ ...KEPT, violations: "direct_push" })), null);
});

test("judgementOf: what the log shows — the event, the line, and who answers for each finding", () => {
  assert.deepEqual(judgementOf(KEPT), {
    event: { kind: "direct_push", pull: null },
    mainLine: true,
    charges: [{ ruleId: "direct_push", login: "sara" }],
    credits: [{ ruleId: "file_lines", login: "lina" }],
  });
});
