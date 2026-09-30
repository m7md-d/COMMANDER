/**
 * A push that is not a landing, judged between its ends — and hand by hand
 * where two authors changed one file (0011). The scenario reference plays this
 * against real git; here, the one choice it makes: the ends, or the hands.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CHECKS, weighPush, type NormalizedCommit, type NormalizedPush } from "@commander/shared";
import { judgeWork } from "./work.js";

const PATH = "src/ledger.ts";
const lines = (count: number) => ({ lines: count, functionLines: null, nestingDepth: null, braceDepth: null, longestLine: null });
const READINGS = new Map([["v190", lines(190)], ["v210", lines(210)], ["v212", lines(212)]]);

function commit(sha: string, author: string, blob: string): NormalizedCommit {
  return { sha, title: "Track refunds in the ledger", url: "", timestamp: "", filesAdded: 0, filesRemoved: 0, filesModified: 1, authorLogin: author, committerLogin: author, parents: ["p"], paths: [PATH], blobs: [[PATH, blob]] };
}

const PUSH: NormalizedPush = {
  repoFullName: "team/repo",
  repoUrl: "",
  branch: "feature/refunds",
  ref: "refs/heads/feature/refunds",
  forced: false,
  created: false,
  deleted: false,
  compareUrl: "",
  actorLogin: "sara",
  actorAvatarUrl: "",
  commits: [commit("c1", "lina", "v210"), commit("c2", "sara", "v212")],
  truncated: false,
};

const judge = (base?: ReadonlyMap<string, string>) => {
  const knownShas: ReadonlySet<string> = new Set();
  const changes = [{ path: PATH, sha: "v212", previousSha: "v190" }];
  const checks = { config: DEFAULT_CHECKS, changes, readings: READINGS, ...(base && { base }) };
  return judgeWork(checks, { push: PUSH, weight: weighPush({ push: PUSH, knownShas }), knownShas, pusher: "sara", trunk: false });
};

test("judgeWork: a file two authors changed is charged to the hand that crossed it", () => {
  const outcome = judge(new Map([[PATH, "v190"]]));

  assert.deepEqual(outcome.violations.map((hit) => `${hit.ruleId}@${hit.login}`), ["file_lines@lina"]);
});

test("judgeWork: without the base listing it names nobody, as the ends always did", () => {
  const outcome = judge();

  assert.deepEqual(outcome.violations.map((hit) => `${hit.ruleId}@${hit.login}`), ["file_lines@null"]);
});
