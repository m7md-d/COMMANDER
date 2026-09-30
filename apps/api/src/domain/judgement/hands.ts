/**
 * Each hand's own change to a file, when several worked on it in one push (0011).
 *
 * A push's ends show only the sum. Between them, Sara may take a file from 190
 * lines to 210 and Lina bring it back to 195: the ends say 190 → 195, and
 * nobody crossed anything. Or Lina crosses the limit and Sara adds two lines on
 * top: the ends show a crossing two people touched, which names nobody. The
 * decision (2026-09-26) is that a crossing is charged to whoever made it, and a
 * fix credited to whoever made that.
 *
 * So the line is read hand by hand. Consecutive commits by one author are one
 * hand, judged on what it handed over — the file before its first commit and
 * after its last — so a draft its author fixed before passing it on is not
 * charged. What each commit left a file holding is its blob (`blobs`, from
 * GitHub's `files[].sha`); what came before the first hand is the listing at
 * the line's root. Any gap — a commit unread, a merge inside the line — and the
 * whole line is left to the ends, as before: a hand judged against the wrong
 * "before" is an accusation.
 */

import type { CheckConfigMap, NormalizedCommit, NormalizedPush } from "@commander/shared";
import { judgeFile, type Reading } from "@/domain/checks/judge.js";
import type { TouchedFile } from "@/domain/tree/diff.js";
import type { Named } from "./attribution.js";

/** A hand's change to one file: what it received and what it handed over, and whose hand it was. */
export interface HandChange extends TouchedFile {
  login: string | null;
}

export interface Hands {
  /** Every change a hand of new work made — a hand of commits already on record makes none here. */
  changes: HandChange[];
  /** Paths more than one author's new work changed: where the ends name nobody and the hands are read. */
  shared: ReadonlySet<string>;
}

/**
 * The line a push's hands are read on: a landing's branch — its own commits,
 * from where it forked — or else the push's commits, from its base.
 */
export function lineOf(input: {
  push: NormalizedPush;
  base: ReadonlyMap<string, string>;
  landing?: { merge: string; fork: ReadonlyMap<string, string> };
}): { commits: NormalizedCommit[]; root: ReadonlyMap<string, string> } {
  const { push, base, landing } = input;
  if (!landing) return { commits: push.commits, root: base };
  return { commits: push.commits.filter((commit) => commit.sha !== landing.merge), root: landing.fork };
}

/** The hand changes judged hand by hand — on shared paths — whose blobs must be measured. */
export function sharedChanges(hands: Hands | null): HandChange[] {
  return hands ? hands.changes.filter((change) => hands.shared.has(change.path)) : [];
}

/** Each shared path's findings, hand by hand, each naming the hand that made it. */
export type HandShares = Map<string, { violations: Named[]; commendations: Named[] }>;

/** The hands' own changes on every shared path, judged: a crossing on whoever made it, a fix to whoever made that. */
export function judgeHands(hands: Hands, on: { config: CheckConfigMap; readings: ReadonlyMap<string, Reading> }): HandShares {
  const shares: HandShares = new Map();
  for (const change of hands.changes) {
    if (!hands.shared.has(change.path)) continue;
    const share = shares.get(change.path) ?? { violations: [], commendations: [] };
    const judged = judgeFile(on.config, change, on.readings);
    share.violations.push(...judged.violations.map((finding) => ({ ...finding, login: change.login })));
    share.commendations.push(...judged.commendations.map((finding) => ({ ...finding, login: change.login })));
    shares.set(change.path, share);
  }
  return shares;
}

interface Hand {
  login: string | null;
  carried: boolean;
  commits: NormalizedCommit[];
}

/**
 * The hands of a line of commits, oldest first, read from `root` — the listing
 * the line starts from (the push's base, or a landing branch's fork). Null when
 * the line cannot be read hand by hand.
 */
export function readHands(input: {
  commits: NormalizedCommit[];
  root: ReadonlyMap<string, string>;
  knownShas: ReadonlySet<string>;
}): Hands | null {
  const { commits, knownShas } = input;
  if (commits.some((commit) => commit.blobs === undefined || (commit.parents?.length ?? 0) !== 1)) return null;

  const state = new Map<string, string | null>(input.root);
  const changes: HandChange[] = [];
  const authors = new Map<string, Set<string | null>>();
  for (const hand of handsOf(commits, knownShas)) {
    for (const change of handOver(hand, state)) {
      if (hand.carried) continue;
      changes.push(change);
      authors.set(change.path, (authors.get(change.path) ?? new Set<string | null>()).add(hand.login));
    }
  }
  const shared = new Set([...authors].filter(([, who]) => who.size > 1).map(([path]) => path));
  return { changes, shared };
}

/** Consecutive commits by one author, new or on record alike, as one hand. */
function handsOf(commits: NormalizedCommit[], knownShas: ReadonlySet<string>): Hand[] {
  const hands: Hand[] = [];
  for (const commit of commits) {
    const login = commit.authorLogin || null;
    const carried = knownShas.has(commit.sha);
    const last = hands.at(-1);
    if (last && last.login === login && last.carried === carried) last.commits.push(commit);
    else hands.push({ login, carried, commits: [commit] });
  }
  return hands;
}

/**
 * What one hand did to each file it touched, applied to `state`. A file the hand
 * moved is read from where it was, so moving a long file is not creating one.
 */
function handOver(hand: Hand, state: Map<string, string | null>): HandChange[] {
  const received = new Map<string, string | null>();
  for (const commit of hand.commits) {
    for (const [from, to] of commit.moves ?? []) {
      if (!received.has(to)) received.set(to, received.has(from) ? (received.get(from) ?? null) : (state.get(from) ?? null));
    }
    for (const [path, blob] of commit.blobs ?? []) {
      if (!received.has(path)) received.set(path, state.get(path) ?? null);
      state.set(path, blob);
    }
  }

  const changes: HandChange[] = [];
  for (const [path, before] of received) {
    const after = state.get(path) ?? null;
    if (after !== null && after !== before) changes.push({ path, sha: after, previousSha: before, login: hand.login });
  }
  return changes;
}
