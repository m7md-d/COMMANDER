/**
 * The reconciler's decisions, apart from its I/O — which branches it reads, and
 * what the commits it finds there become — so the scenario reference can call
 * them rather than copy them.
 *
 * What a branch gained while nobody was listening becomes one recovered push,
 * rebuilt from REST commit data so it runs through the exact pipeline a live
 * webhook would. File counts are 0 — the list endpoint carries no file data;
 * the enrichment pass fills them before anything is judged.
 */

import { branchIsWatched, watchesEverything } from "@commander/shared";
import type { NormalizedCommit, NormalizedPush } from "@commander/shared";
import { RECONCILE_LOOKBACK_MS } from "@/config/constants.js";
import type { CommitListEntry } from "@/integrations/github/commits.client.js";

/**
 * Where a pass starts reading, in ms: the lookback floor, or when the front began
 * being watched if that is later. What is already on record is dropped by sha,
 * never by date.
 *
 * The newest commit on record used to be the cursor, and the record is the
 * whole repository's: a push that arrived on another branch after a lost one
 * moved it past the lost commits, and they were never read (D-23, scenario
 * `lost-push-overtaken-by-a-later-one`). Before the front existed nothing was
 * lost — nobody was listening — so its creation bounds the read instead.
 */
export function readSince(input: { now: number; watchedSince: number }): number {
  return Math.max(input.now - RECONCILE_LOOKBACK_MS, input.watchedSince);
}

/** A branch the reconciler reads, and how. */
export interface BranchRead {
  branch: string;
  /**
   * Read only what the branch has beyond this one; null to read its history
   * since the cursor. Only the default branch is read by its history. Any other
   * holds everything it inherited when it was cut, and on a front that does not
   * watch the default branch none of that is on record — read by time, it came
   * back as pushes to this branch and was charged to whoever wrote it
   * (scenario `branch-cut-from-an-unwatched-main`).
   */
  beyond: string | null;
  /** The head the listing showed, stored once the read succeeds; null without a listing. */
  head: string | null;
}

/**
 * The branches the reconciler reads for a front.
 *
 * With a listing, each watched branch whose head moved since a pass last read
 * it — every branch, on a front that watches them all. A branch whose head has
 * not moved gained nothing, so it costs no request: that is what lets a front
 * that watches every branch be read on every branch. It used to be read on its
 * default branch alone, and a push lost anywhere else stayed lost (D-24).
 *
 * A pattern is not a branch the commits API can read, so it is matched against
 * the listing. Without one, the branches the front names are read, and the
 * default branch on a front that watches every branch.
 *
 * Without the default branch nothing is read: there would be no telling a
 * branch's own work from what it inherited, and a guess here is an accusation.
 */
export function branchesToReconcile(input: {
  watch: string[];
  /** Each branch's head, or null when they could not be listed. */
  existing: ReadonlyMap<string, string> | null;
  /** Each branch's head when a pass last read it. */
  lastRead: ReadonlyMap<string, string>;
  /** The repository's default branch, or null when it is not known. */
  defaultBranch: string | null;
}): BranchRead[] {
  const { watch, existing, lastRead, defaultBranch } = input;
  if (!defaultBranch) return [];
  const read = (branch: string, head: string | null): BranchRead => ({
    branch,
    beyond: branch === defaultBranch ? null : defaultBranch,
    head,
  });

  if (existing === null) {
    const named = watchesEverything(watch) ? [defaultBranch] : watch.filter((entry) => entry.length > 0 && !entry.includes("*"));
    return named.map((branch) => read(branch, null));
  }
  return [...existing]
    .filter(([branch, head]) => branchIsWatched(watch, branch) && lastRead.get(branch) !== head)
    .map(([branch, head]) => read(branch, head));
}

/**
 * One recovered push for everything the branch gained, each commit keeping its
 * author — never one push per author.
 *
 * The push event is gone, and git records who wrote each commit and who
 * committed it, never who pushed it. Grouping by author invented a push for
 * each of them: an author was charged with a push someone else made, and with a
 * batch of commits they had pushed across a day (0009 §4, scenario
 * `contributors-branch-pushed-by-a-maintainer-webhook-lost`). So the push names
 * no pusher — `recovered` — and is addressed to the author of its newest commit,
 * unless GitHub's events timeline names one (`reconciler.pushers.ts`).
 */
export function recoveredPush(
  repo: { fullName: string; defaultBranch: string },
  branch: string,
  commits: CommitListEntry[],
): NormalizedPush | null {
  const newest = commits.at(-1);
  if (!newest) return null;

  return {
    repoFullName: repo.fullName,
    repoUrl: `https://github.com/${repo.fullName}`,
    branch,
    ref: `refs/heads/${branch}`,
    forced: false,
    created: false,
    deleted: false,
    compareUrl: "",
    // Known to the reconciler, which reads every branch against it: a charge on a
    // recovered push to main weighs what it would have by webhook.
    defaultBranch: repo.defaultBranch,
    actorLogin: newest.authorLogin || "unknown",
    actorAvatarUrl: "",
    recovered: true,
    commits: commits.map(toCommit),
    truncated: false,
  };
}

function toCommit(entry: CommitListEntry): NormalizedCommit {
  return {
    sha: entry.sha,
    title: entry.title,
    url: entry.url,
    timestamp: entry.timestamp,
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 0,
    authorLogin: entry.authorLogin,
    committerLogin: entry.committerLogin,
  };
}
