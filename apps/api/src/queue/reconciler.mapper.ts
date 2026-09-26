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
import type { CommitListEntry } from "@/integrations/github/commits.client.js";

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
}

/**
 * The branches the reconciler reads for a front.
 *
 * A front that watches every branch is read on its default branch alone:
 * reading them all costs a request per branch on every pass, stale ones
 * included, which is a price nobody chose by leaving the default in place.
 *
 * Any other front is read on each existing branch it watches. A pattern is not
 * a branch the commits API can read, so it is matched against the listing —
 * reading the default branch in its place read a branch the front might not
 * watch at all, and everything recovered from it was skipped as unwatched.
 * Without a listing, the branches the front names are still readable.
 *
 * Without the default branch nothing is read: there would be no telling a
 * branch's own work from what it inherited, and a guess here is an accusation.
 */
export function branchesToReconcile(input: {
  watch: string[];
  /** The repository's branches, or null when they could not be listed. */
  existing: string[] | null;
  /** The repository's default branch, or null when it is not known. */
  defaultBranch: string | null;
}): BranchRead[] {
  const { watch, existing, defaultBranch } = input;
  if (!defaultBranch) return [];
  if (watchesEverything(watch)) return [{ branch: defaultBranch, beyond: null }];

  const watched =
    existing === null
      ? watch.filter((entry) => entry.length > 0 && !entry.includes("*"))
      : existing.filter((branch) => branchIsWatched(watch, branch));
  return watched.map((branch) => ({ branch, beyond: branch === defaultBranch ? null : defaultBranch }));
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
 * no pusher — `recovered` — and is addressed to the author of its newest commit.
 */
export function recoveredPush(
  repo: { fullName: string },
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
