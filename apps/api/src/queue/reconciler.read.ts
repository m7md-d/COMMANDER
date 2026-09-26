/**
 * What the reconciler asks GitHub, each failure logged and turned into silence:
 * a pass that cannot read recovers nothing, and the next pass asks again.
 *
 * Split from `reconciler.ts` when reading a branch became two questions — its
 * history for the default branch, its work beyond the default for any other.
 * Which question is asked of which branch is decided in `branchesToReconcile`.
 */

import { createLogger } from "@/core/logger/logger.js";
import { compareCommits, fetchDefaultBranch, listBranches } from "@/integrations/github/branches.client.js";
import { listCommits, type CommitListEntry } from "@/integrations/github/commits.client.js";
import type { BranchRead } from "./reconciler.mapper.js";

const log = createLogger("reconciler");

export interface ReadTarget {
  fullName: string;
  githubInstallationId: string;
}

export async function readDefaultBranch(repo: ReadTarget): Promise<string | null> {
  const meta = await fetchDefaultBranch(repo.githubInstallationId, repo.fullName);
  if (meta.ok && meta.data) return meta.data;
  log.warn("default branch unknown", { repo: repo.fullName });
  return null;
}

/** Null when the listing fails; the named branches are then read, the patterns are not. */
export async function readBranches(repo: ReadTarget): Promise<string[] | null> {
  const listed = await listBranches(repo.githubInstallationId, repo.fullName);
  if (!listed.ok) {
    log.warn("list branches failed", { repo: repo.fullName, error: listed.error });
    return null;
  }
  if (!listed.data.complete) {
    log.warn("branch listing cut short", { repo: repo.fullName, listed: listed.data.names.length });
  }
  return listed.data.names;
}

/**
 * The branch's commits since the cursor, oldest first: the default branch's
 * history, any other branch's work beyond the default (see BranchRead).
 */
export async function readMissed(repo: ReadTarget, read: BranchRead, since: Date): Promise<CommitListEntry[]> {
  const target = { installationId: repo.githubInstallationId, repoFullName: repo.fullName };

  if (read.beyond === null) {
    const result = await listCommits({ ...target, branch: read.branch, since });
    // The API returns newest-first; the pipeline and ledger read oldest-first.
    if (result.ok) return [...result.data].reverse();
    if (!result.notFound) log.warn("list commits failed", { repo: repo.fullName, branch: read.branch, error: result.error });
    return [];
  }

  const result = await compareCommits({ ...target, base: read.beyond, head: read.branch });
  if (!result.ok) {
    if (!result.notFound) log.warn("compare failed", { repo: repo.fullName, branch: read.branch, error: result.error });
    return [];
  }
  if (!result.data.complete) log.warn("compare cut short", { repo: repo.fullName, branch: read.branch });
  return result.data.commits.filter((commit) => Date.parse(commit.timestamp) >= since.getTime());
}
