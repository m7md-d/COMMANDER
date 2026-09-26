/**
 * What a push actually brought, as opposed to what it carries.
 *
 * A merge to a trunk arrives holding every commit of the branch it closes —
 * commits this repository already saw, already reported on, and already charged
 * for. Counted as they arrive, the same work is judged twice: the branch push
 * charges it once, and the merge charges it again with the merge commit's own
 * aggregate stacked on top. `totalFilesTouched` sums every commit in the push,
 * so the double count is ours before it is GitHub's.
 *
 * Two things follow, and both matter:
 *
 * 1. **Re-delivered work weighs nothing.** A commit whose sha this repository
 *    already holds brought no new work, whatever ref it now appears under.
 * 2. **A merge weighs its residue** — what it contains that none of the commits
 *    it brings in contain. A clean merge's residue is empty, which is exactly
 *    git's own answer (`diff --cc` shows only what differs from every parent).
 *    A merge that quietly carries lines belonging to no commit has a residue,
 *    and that residue *is* those lines: the one place where something hidden in
 *    a large merge stops being hidden.
 *
 * Everything here is pure and works from data alone (§2). When the data is not
 * there — no enrichment, no App — `measured` is false and the caller falls back
 * rather than guessing, because a merge judged on absent parents is an
 * accusation built on nothing.
 */

import type { NormalizedCommit, NormalizedPush } from "./push.js";

export interface PushWeight {
  /** Commits carrying work this repository had not already recorded. */
  newCommits: number;
  /** Files that new work touched; a merge contributes only its residue. */
  filesTouched: number;
  /** Paths a merge introduced that no commit it brings in introduced. */
  residue: string[];
  /**
   * Paths new work touched: every path of a new commit, and a new merge's
   * residue. What the checks may judge — a file only carried by commits already
   * on record was judged when they arrived. Empty when unmeasured.
   */
  paths: string[];
  /** True only when every commit carried the parents and paths to weigh it. */
  measured: boolean;
}

/** Two parents or more. The only signal that does not rely on a title. */
export function isMerge(commit: NormalizedCommit): boolean {
  return (commit.parents?.length ?? 0) >= 2;
}

const filesIn = (commit: NormalizedCommit): number =>
  commit.filesAdded + commit.filesRemoved + commit.filesModified;

/**
 * Can a residue be trusted at all?
 *
 * Three ways it cannot, each of which would make an honest merge look like it
 * introduced the entire branch on its own — the exact false accusation this is
 * here to prevent:
 *
 * - **A commit without paths.** It looks like it introduced nothing, so its
 *   files get attributed to the merge instead.
 * - **A truncated payload.** GitHub caps a push at 20 commits; the ones it
 *   dropped are constituents we would never see.
 * - **A merge whose branch is not in this push.** Its second parent identifies
 *   the branch head; if that sha is absent, the commits it stands for are absent
 *   too, and every path the merge carries would read as its own.
 */
function isWeighable(push: NormalizedPush): boolean {
  if (push.commits.length === 0 || push.truncated) return false;
  if (!push.commits.every((commit) => commit.paths !== undefined)) return false;

  const present = new Set(push.commits.map((commit) => commit.sha));
  return push.commits
    .filter(isMerge)
    .every((merge) => (merge.parents ?? []).slice(1).some((sha) => present.has(sha)));
}

/**
 * Weighs a push against what the repository already knows.
 *
 * `knownShas` is passed in rather than looked up: this stays a pure function,
 * and the caller is the only layer allowed to touch the database anyway.
 */
export function weighPush(input: {
  push: NormalizedPush;
  knownShas: ReadonlySet<string>;
}): PushWeight {
  const { push, knownShas } = input;
  const fresh = push.commits.filter((commit) => !knownShas.has(commit.sha));

  if (!isWeighable(push)) {
    return {
      newCommits: fresh.length,
      filesTouched: fresh.reduce((sum, commit) => sum + filesIn(commit), 0),
      residue: [],
      paths: [],
      measured: false,
    };
  }

  const carried = new Set<string>();
  for (const commit of push.commits) {
    if (isMerge(commit)) continue;
    for (const path of commit.paths ?? []) carried.add(path);
  }

  const residue = new Set<string>();
  const paths = new Set<string>();
  let filesTouched = 0;

  for (const commit of fresh) {
    if (!isMerge(commit)) {
      filesTouched += filesIn(commit);
      (commit.paths ?? []).forEach((path) => paths.add(path));
      continue;
    }
    // The merge's own contribution, and nothing it merely transports.
    const own = (commit.paths ?? []).filter((path) => !carried.has(path));
    own.forEach((path) => {
      residue.add(path);
      paths.add(path);
    });
    filesTouched += own.length;
  }

  return { newCommits: fresh.length, filesTouched, residue: [...residue], paths: [...paths], measured: true };
}
