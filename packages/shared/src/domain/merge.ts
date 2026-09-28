/**
 * What a push actually brought, as opposed to what it carries.
 *
 * A merge to a trunk arrives holding every commit of the branch it closes —
 * commits this repository may already have seen, reported on, and charged
 * for. Counted as they arrive, the same work is judged twice: the branch push
 * charges it once, and the merge charges it again with the merge commit's own
 * aggregate stacked on top. `totalFilesTouched` sums every commit in the push,
 * so the double count is ours before it is GitHub's.
 *
 * Three things follow, and all of them matter:
 *
 * 1. **Two questions, two answers.** What this push *brought* is what nobody
 *    had pushed before — GitHub's `distinct` — and what the size rules count:
 *    landing a branch that was pushed elsewhere first is not a heap of work
 *    dumped at once. What the record has *not judged yet* is wider: work pushed
 *    first to a branch this front does not watch is judged when it first
 *    arrives, whichever push carries it — and charged to whoever wrote it, not
 *    to whoever carried it (0009 §4).
 * 2. **Work already on record weighs nothing.** A commit whose sha this
 *    repository already holds was judged when it arrived, whatever ref it now
 *    appears under.
 * 3. **A merge weighs its residue** — what it contains that none of the commits
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
  /** Commits this push brought: pushed nowhere in the repository before, and not on record. */
  newCommits: number;
  /**
   * Files those commits touched, each once however many of them touched it; a
   * merge contributes only its residue. Null when a brought commit came without
   * its paths or parents — no App, or a detail call that failed or was not made:
   * a merge cannot then be told from ordinary work, and its first-parent diff,
   * someone else's work, would be counted as the pusher's.
   */
  filesTouched: number | null;
  /**
   * What each commit the record has not judged yet did on its own — every path
   * of a commit; of a merge, its residue: the paths it introduced that no
   * commit it brings in introduced — whichever branch it was pushed to first.
   * What the checks and `merge_residue` judge, and whose author answers for
   * it. Empty when unmeasured.
   */
  work: CommitWork[];
  /** True only when every commit carried the parents and paths to weigh it. */
  measured: boolean;
}

export interface CommitWork {
  sha: string;
  paths: string[];
}

/** Two parents or more. The only signal that does not rely on a title. */
export function isMerge(commit: NormalizedCommit): boolean {
  return (commit.parents?.length ?? 0) >= 2;
}

/**
 * Can a residue be trusted at all?
 *
 * Three ways it cannot, each of which would make an honest merge look like it
 * introduced the entire branch on its own — the exact false accusation this is
 * here to prevent:
 *
 * - **A commit without paths or parents.** It looks like it introduced nothing,
 *   so its files get attributed to the merge instead — or it is a merge nobody
 *   can see.
 * - **A truncated payload.** GitHub caps a push at 2,048 commits; the ones it
 *   dropped are constituents we would never see.
 * - **A merge whose branch is not in this push.** Its second parent identifies
 *   the branch head; if that sha is absent, the commits it stands for are absent
 *   too, and every path the merge carries would read as its own.
 */
function isWeighable(push: NormalizedPush): boolean {
  if (push.commits.length === 0 || push.truncated) return false;
  if (push.commits.some(isUnread)) return false;

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
  const unjudged = push.commits.filter((commit) => !knownShas.has(commit.sha));
  // Undefined on a recovered push: the record is then the only answer there is.
  const brought = unjudged.filter((commit) => commit.distinct !== false);

  const own = ownPaths(push);
  const filesTouched = brought.some(isUnread) ? null : new Set(brought.flatMap(own)).size;

  if (!isWeighable(push)) return { newCommits: brought.length, filesTouched, work: [], measured: false };
  return {
    newCommits: brought.length,
    filesTouched,
    work: unjudged.map((commit) => ({ sha: commit.sha, paths: own(commit) })),
    measured: true,
  };
}

/** A commit enrichment did not reach: its paths, and whether it is a merge, are unknown. */
const isUnread = (commit: NormalizedCommit): boolean => commit.paths === undefined || commit.parents === undefined;

/**
 * Enrichment ran and did not reach every commit — the push was longer than it
 * reads (`MAX_ENRICHED_COMMITS`), or a detail call failed. Nothing in it is then
 * weighed or measured, and the communiqué says so: silence must not read as a
 * clean push. A push nothing was read of is a front with no App, which the setup
 * states once rather than every report.
 */
export function readInPart(push: NormalizedPush): boolean {
  return push.commits.some(isUnread) && !push.commits.every(isUnread);
}

/**
 * What each commit of a push did on its own: an ordinary commit, every path; a
 * merge, only what none of the push's commits touched — its residue.
 *
 * A merge whose other side is outside the push — `git pull`, a foxtrot — joins
 * history already on a branch. Its first-parent diff is that history, someone
 * else's work, and what is its own cannot be told from paths alone: it adds
 * nothing, so a count built on it can only be low (scenario
 * `git-pull-merge-then-push`).
 */
function ownPaths(push: NormalizedPush): (commit: NormalizedCommit) => string[] {
  const present = new Set(push.commits.map((commit) => commit.sha));
  const carried = new Set(push.commits.filter((commit) => !isMerge(commit)).flatMap((commit) => commit.paths ?? []));

  return (commit) => {
    if (!isMerge(commit)) return commit.paths ?? [];
    const joined = (commit.parents ?? []).slice(1).some((sha) => present.has(sha));
    return joined ? (commit.paths ?? []).filter((path) => !carried.has(path)) : [];
  };
}
