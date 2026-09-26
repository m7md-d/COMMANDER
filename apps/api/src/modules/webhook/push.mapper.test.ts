/**
 * The fields of GitHub's push payload the judgement reads. The scenario
 * reference feeds `normalizePush` whole payloads; this pins the two whose
 * absence must stay distinguishable from their value.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePush } from "./push.mapper.js";

const payload = (commit: Record<string, unknown>) => ({
  ref: "refs/heads/main",
  repository: { full_name: "team/repo" },
  commits: [{ id: "c".repeat(40), message: "Merge pull request #12", ...commit }],
});

test("distinct is read as GitHub sent it, and left out when it did not send it", () => {
  // False means the commit was pushed to this repository before, on some branch:
  // landing it again is not new work, and the size rules must not count it.
  assert.equal(normalizePush(payload({ distinct: false })).commits[0]?.distinct, false);
  assert.equal(normalizePush(payload({ distinct: true })).commits[0]?.distinct, true);
  assert.equal("distinct" in (normalizePush(payload({})).commits[0] ?? {}), false, "absent: the record decides");
});

test("the default branch is read from the repository object, and left out when absent", () => {
  // What makes main a main line: work landing there is answered for by whoever lands it.
  const named = normalizePush({ ...payload({}), repository: { full_name: "team/repo", default_branch: "trunk" } });

  assert.equal(named.defaultBranch, "trunk");
  assert.equal("defaultBranch" in normalizePush(payload({})), false);
});
