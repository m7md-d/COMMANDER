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
import { listPushEvents, type PushEventEntry } from "@/integrations/github/events.client.js";
import type { BranchRead } from "./reconciler.mapper.js";
import { eventsToRead, type TimelinePush } from "./reconciler.pushers.js";

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

/** Each branch's head; null when the listing fails, and the named branches are then read, the patterns are not. */
export async function readBranches(repo: ReadTarget): Promise<Map<string, string> | null> {
  const listed = await listBranches(repo.githubInstallationId, repo.fullName);
  if (!listed.ok) {
    log.warn("list branches failed", { repo: repo.fullName, error: listed.error });
    return null;
  }
  if (!listed.data.complete) {
    log.warn("branch listing cut short", { repo: repo.fullName, listed: listed.data.heads.size });
  }
  return listed.data.heads;
}

/**
 * The branch's commits since the cursor, oldest first: the default branch's
 * history, any other branch's work beyond the default (see BranchRead). Null
 * when GitHub could not be read, so the branch's head is not taken as read.
 * A branch that is gone reads as empty: there is nothing left on it to recover.
 */
export async function readMissed(repo: ReadTarget, read: BranchRead, since: Date): Promise<CommitListEntry[] | null> {
  const target = { installationId: repo.githubInstallationId, repoFullName: repo.fullName };

  if (read.beyond === null) {
    const result = await listCommits({ ...target, branch: read.branch, since });
    // The API returns newest-first; the pipeline and ledger read oldest-first.
    if (result.ok) return [...result.data].reverse();
    if (result.notFound) return [];
    log.warn("list commits failed", { repo: repo.fullName, branch: read.branch, error: result.error });
    return null;
  }

  const result = await compareCommits({ ...target, base: read.beyond, head: read.branch });
  if (!result.ok) {
    if (result.notFound) return [];
    log.warn("compare failed", { repo: repo.fullName, branch: read.branch, error: result.error });
    return null;
  }
  if (!result.data.complete) log.warn("compare cut short", { repo: repo.fullName, branch: read.branch });
  return result.data.commits.filter((commit) => Date.parse(commit.timestamp) >= since.getTime());
}

/** The push events on GitHub's timeline; none when it cannot be read, and the gap then names nobody. */
export async function readPushEvents(repo: ReadTarget): Promise<PushEventEntry[]> {
  const result = await listPushEvents(repo.githubInstallationId, repo.fullName);
  if (result.ok) return result.data;
  log.warn("events timeline unread", { repo: repo.fullName, error: result.error });
  return [];
}

/**
 * The pushes the timeline shows for a gap, each with the commits its
 * `before..head` holds. An event whose head did not only add to its before — a
 * force push — is left out: what it rewrote is not in the list, and naming it a
 * plain push would hide that.
 */
export async function readTimeline(
  repo: ReadTarget,
  at: { events: PushEventEntry[]; branch: string; gap: CommitListEntry[] },
): Promise<TimelinePush[]> {
  const target = { installationId: repo.githubInstallationId, repoFullName: repo.fullName };
  const pushes: TimelinePush[] = [];
  for (const event of eventsToRead(at)) {
    const result = await compareCommits({ ...target, base: event.before, head: event.head });
    if (!result.ok || !result.data.ahead || !result.data.complete) continue;
    pushes.push({ pusher: event.actor, shas: result.data.commits.map((commit) => commit.sha) });
  }
  return pushes;
}
