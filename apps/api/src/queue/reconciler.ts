/**
 * Recovers pushes that never reached the webhook because the server was offline
 * when they happened — nothing guarantees the host is awake, and GitHub gives up
 * on a delivery after a few retries (see docs/DEPLOY.md). For each watched
 * repository it asks GitHub for the commits of the lookback window that are not
 * on record, and enqueues each branch's gap as one recovered push, so it flows
 * through the same pipeline as a live one.
 *
 * Gated on the GitHub App: with no installation token there is no way to read a
 * repo's history, so without it this is a no-op and missed pushes stay missed.
 * Best-effort — it cannot see a branch deleted during downtime, nor history a
 * force push overwrote. A branch is read only when its head moved since a pass
 * last read it (see branchesToReconcile).
 */

import type { NormalizedPush } from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { createLogger, describeError } from "@/core/logger/logger.js";
import { fromJson } from "@/core/json.js";
import { isGitHubAppConfigured } from "@/integrations/github/app-auth.js";
import type { CommitListEntry } from "@/integrations/github/commits.client.js";
import type { PushEventEntry } from "@/integrations/github/events.client.js";
import { syncTree } from "@/modules/tree/tree.service.js";
import { enqueue } from "./outbox.service.js";
import { branchesToReconcile, readSince, recoveredPush, type BranchRead } from "./reconciler.mapper.js";
import { forgetGone, loadLastRead, rememberRead } from "./reconciler.heads.js";
import { pushedBy, splitByPusher } from "./reconciler.pushers.js";
import { readBranches, readDefaultBranch, readMissed, readPushEvents, readTimeline } from "./reconciler.read.js";
import { sweepMeasurements } from "./reconciler.sweep.js";

const log = createLogger("reconciler");

interface RepoTarget {
  id: string;
  fullName: string;
  githubInstallationId: string;
  branches: string[];
  createdAt: Date;
}

export async function reconcile(): Promise<void> {
  if (!isGitHubAppConfigured()) return;

  const repos = await prisma.repository.findMany({
    where: { enabled: true, githubInstallationId: { not: "" } },
    select: { id: true, fullName: true, githubInstallationId: true, branches: true, createdAt: true },
  });
  if (repos.length === 0) return;

  let recovered = 0;
  for (const repo of repos) {
    try {
      recovered += await reconcileRepo(repo);
    } catch (error) {
      log.error("repo reconcile failed", { repo: repo.fullName, ...describeError(error) });
    }
  }
  if (recovered > 0) log.info("reconcile complete", { recovered });
}

async function reconcileRepo(repo: RepoTarget): Promise<number> {
  // The tree is reconciled here rather than on its own timer for the same reason
  // this file exists at all: we do not trust that every event arrived. A push
  // processed while GitHub was refusing requests left the snapshot behind, and
  // nothing else would ever notice — the next push only re-reads the tree, it
  // never audits the rows already stored.
  await syncTree(repo.id);

  // Then measure a batch of whatever is still uncounted. Pushes only ever reach
  // the files they touch, and a crossing cannot be told from an inheritance
  // without knowing what the *untouched* files already were — so the baseline of
  // a project is filled in here, a batch at a time, until it is complete.
  await sweepMeasurements(repo);

  const { reads, defaultBranch } = await resolveBranches(repo);
  if (reads.length === 0 || !defaultBranch) return 0;

  const since = new Date(readSince({ now: Date.now(), watchedSince: repo.createdAt.getTime() }));
  // Asked once a pass, and only when some branch has a gap: most passes have none.
  let events: Promise<PushEventEntry[]> | null = null;
  const timeline = () => (events ??= readPushEvents(repo));
  let recovered = 0;
  for (const read of reads) {
    recovered += await reconcileBranch({ ...repo, defaultBranch, timeline }, read, since);
  }
  return recovered;
}

/**
 * Which branches to read, and how, is `branchesToReconcile`'s decision. This
 * fetches what it needs: the default branch — what every other branch is read
 * against — each branch's head, and the head each had when last read.
 */
async function resolveBranches(repo: RepoTarget): Promise<{ reads: BranchRead[]; defaultBranch: string | null }> {
  const [defaultBranch, existing, lastRead] = await Promise.all([
    readDefaultBranch(repo),
    readBranches(repo),
    loadLastRead(repo.id),
  ]);
  if (existing) await forgetGone(repo.id, existing);
  return { reads: branchesToReconcile({ watch: repo.branches, existing, lastRead, defaultBranch }), defaultBranch };
}

interface BranchTarget extends RepoTarget {
  defaultBranch: string;
  /** GitHub's push events, read on first need. */
  timeline: () => Promise<PushEventEntry[]>;
}

async function reconcileBranch(repo: BranchTarget, read: BranchRead, since: Date): Promise<number> {
  const listed = await readMissed(repo, read, since);
  if (listed === null) return 0;

  const recovered = await recover(repo, read.branch, listed);
  // Only now: had the enqueue thrown, the branch is asked again next pass.
  if (read.head) await rememberRead({ repositoryId: repo.id, branch: read.branch, sha: read.head });
  return recovered;
}

/**
 * The branch's gap, enqueued as the pushes that made it: each push GitHub's
 * timeline shows, named by its pusher, and one naming nobody for the rest
 * (`splitByPusher`).
 */
async function recover(repo: BranchTarget, branch: string, listed: CommitListEntry[]): Promise<number> {
  const known = await knownShas(repo.id, listed.map((commit) => commit.sha));
  const gap = listed.filter((commit) => !known.has(commit.sha));
  if (gap.length === 0) return 0;

  const timeline = await readTimeline(repo, { events: await repo.timeline(), branch, gap });
  for (const part of splitByPusher(gap, timeline)) {
    const push = recoveredPush(repo, branch, part.commits);
    if (push) await enqueue({ occasion: { kind: "push", push: pushedBy(push, part.pusher) }, repositoryId: repo.id });
  }

  log.info("recovered missed commits", { repo: repo.fullName, branch, commits: gap.length, named: timeline.length });
  return gap.length;
}

/**
 * Shas we must not re-enqueue: those already in the ledger (processed) and those
 * sitting in deliveries not yet processed (received but pending). The second set
 * closes the race where a push arrived just before a restart, so its commits are
 * not in the ledger yet but must not be recovered a second time.
 */
async function knownShas(repositoryId: string, shas: string[]): Promise<Set<string>> {
  if (shas.length === 0) return new Set();

  const [records, active] = await Promise.all([
    prisma.commitRecord.findMany({
      where: { repositoryId, sha: { in: shas } },
      select: { sha: true },
    }),
    prisma.delivery.findMany({
      where: { repositoryId, status: { in: ["pending", "processing"] } },
      select: { payload: true },
    }),
  ]);

  const known = new Set(records.map((record) => record.sha));
  for (const row of active) {
    for (const commit of fromJson<NormalizedPush>(row.payload).commits) {
      known.add(commit.sha);
    }
  }
  return known;
}
