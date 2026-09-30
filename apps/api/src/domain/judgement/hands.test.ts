/**
 * Each hand in one push judged on what it handed over (0011): who crossed a
 * limit and who brought the file back, when the ends show only the sum.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CHECKS, type NormalizedCommit } from "@commander/shared";
import { judgeHands, readHands } from "./hands.js";

const ROOT = new Map([["src/ledger.ts", "v190"]]);
const NONE: ReadonlySet<string> = new Set();

function commit(sha: string, author: string, blobs: [string, string | null][]): NormalizedCommit {
  return { sha, title: "work", url: "", timestamp: "", filesAdded: 0, filesRemoved: 0, filesModified: 1, authorLogin: author, committerLogin: author, parents: ["p"], blobs };
}

const shape = (hands: ReturnType<typeof readHands>) => hands?.changes.map((change) => `${change.login}:${change.path}:${change.previousSha}->${change.sha}`);

test("each author's run of commits is one hand, judged on what it received and handed over", () => {
  const hands = readHands({
    commits: [commit("c1", "sara", [["src/ledger.ts", "v210"]]), commit("c2", "lina", [["src/ledger.ts", "v195"]])],
    root: ROOT,
    knownShas: NONE,
  });

  assert.deepEqual(shape(hands), ["sara:src/ledger.ts:v190->v210", "lina:src/ledger.ts:v210->v195"]);
  assert.deepEqual([...(hands?.shared ?? [])], ["src/ledger.ts"]);
});

test("a draft its author fixed before passing it on is not a change of its own", () => {
  const hands = readHands({
    commits: [commit("c1", "sara", [["src/ledger.ts", "v210"]]), commit("c2", "sara", [["src/ledger.ts", "v195"]])],
    root: ROOT,
    knownShas: NONE,
  });

  assert.deepEqual(shape(hands), ["sara:src/ledger.ts:v190->v195"]);
  assert.equal(hands?.shared.size, 0, "one author is not shared work");
});

test("sara, lina, sara are three hands", () => {
  const hands = readHands({
    commits: [commit("c1", "sara", [["src/ledger.ts", "v210"]]), commit("c2", "lina", [["src/ledger.ts", "v195"]]), commit("c3", "sara", [["src/ledger.ts", "v205"]])],
    root: ROOT,
    knownShas: NONE,
  });

  assert.equal(hands?.changes.length, 3);
});

test("a hand of commits already on record is read through, and charged nothing again", () => {
  const hands = readHands({
    commits: [commit("c1", "sara", [["src/ledger.ts", "v210"]]), commit("c2", "lina", [["src/ledger.ts", "v212"]])],
    root: ROOT,
    knownShas: new Set(["c1"]),
  });

  assert.deepEqual(shape(hands), ["lina:src/ledger.ts:v210->v212"]);
});

test("a file moved is read from where it was, and a removed file is no change", () => {
  const hands = readHands({
    commits: [
      { ...commit("c1", "sara", [["src/ledger.ts", null], ["src/books.ts", "v190"]]), moves: [["src/ledger.ts", "src/books.ts"]] },
      commit("c2", "lina", [["src/books.ts", null]]),
    ],
    root: ROOT,
    knownShas: NONE,
  });

  assert.deepEqual(shape(hands), []);
});

test("a commit unread, or a merge inside the line, leaves the whole line to the ends", () => {
  const unread = commit("c2", "lina", []);
  delete unread.blobs;
  const merge = { ...commit("c2", "lina", [["src/ledger.ts", "v195"]]), parents: ["a", "b"] };

  for (const second of [unread, merge]) {
    assert.equal(readHands({ commits: [commit("c1", "sara", [["src/ledger.ts", "v210"]]), second], root: ROOT, knownShas: NONE }), null);
  }
});

test("judgeHands charges a crossing on the hand that made it and credits the one that fixed it", () => {
  const hands = readHands({
    commits: [commit("c1", "sara", [["src/ledger.ts", "v210"]]), commit("c2", "lina", [["src/ledger.ts", "v195"]])],
    root: ROOT,
    knownShas: NONE,
  });
  assert.ok(hands);
  const lines = (count: number) => ({ lines: count, functionLines: null, nestingDepth: null, braceDepth: null, longestLine: null });
  const readings = new Map([["v190", lines(190)], ["v210", lines(210)], ["v195", lines(195)]]);

  const share = judgeHands(hands, { config: DEFAULT_CHECKS, readings }).get("src/ledger.ts");

  assert.deepEqual(share?.violations.map((hit) => `${hit.ruleId}@${hit.login}`), ["file_lines@sara"]);
  assert.deepEqual(share?.commendations.map((hit) => `${hit.ruleId}@${hit.login}`), ["file_lines@lina"]);
});
