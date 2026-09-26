/**
 * The reconciler's decisions, apart from its I/O — which branches it reads, and
 * how the commits it finds there become pushes — so the scenario reference can
 * call them rather than copy them.
 *
 * The pushes are rebuilt from REST commit data so a recovered push runs through
 * the exact pipeline a live webhook would. Grouped by author login rather than
 * lumped under one pusher: the original push
 * event is gone, so there is no pusher to name, and grouping keeps each commit
 * attributed to its real author in the dossier. File counts are 0 — the list
 * endpoint carries no file data; the enrichment pass fills line counts once the
 * commit is on record.
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

export function buildSyntheticPushes(
  repo: { fullName: string },
  branch: string,
  commits: CommitListEntry[],
): NormalizedPush[] {
  const byAuthor = new Map<string, CommitListEntry[]>();
  for (const commit of commits) {
    const login = commit.authorLogin || commit.committerLogin || "unknown";
    const bucket = byAuthor.get(login);
    if (bucket) bucket.push(commit);
    else byAuthor.set(login, [commit]);
  }

  const ref = `refs/heads/${branch}`;
  return [...byAuthor].map(([login, entries]) => ({
    repoFullName: repo.fullName,
    repoUrl: `https://github.com/${repo.fullName}`,
    branch,
    ref,
    forced: false,
    created: false,
    deleted: false,
    compareUrl: "",
    actorLogin: login,
    actorAvatarUrl: "",
    commits: entries.map(toCommit),
    truncated: false,
  }));
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
