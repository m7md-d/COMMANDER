/**
 * Recovers pushes that never reached the webhook because the server was offline
 * when they happened — nothing guarantees the host is awake, and GitHub gives up
 * on a delivery after a few retries (see docs/DEPLOY.md). For each watched
 * repository it asks GitHub for commits newer than the last one on record and
 * enqueues the gap as synthetic pushes, so a recovered push flows through the
 * same pipeline as a live one.
 *
 * Gated on the GitHub App: with no installation token there is no way to read a
 * repo's history, so without it this is a no-op and missed pushes stay missed.
 * Best-effort — it cannot see a branch deleted during downtime, nor history a
 * force push overwrote, and a front that watches every branch is read on its
 * default branch alone (see branchesToReconcile).
 */

import { watchesEverything, type NormalizedPush } from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { createLogger, describeError } from "@/core/logger/logger.js";
import { fromJson } from "@/core/json.js";
import { RECONCILE_LOOKBACK_MS } from "@/config/constants.js";
import { isGitHubAppConfigured } from "@/integrations/github/app-auth.js";
import { syncTree } from "@/modules/tree/tree.service.js";
import { enqueue } from "./outbox.service.js";
import { branchesToReconcile, buildSyntheticPushes, type BranchRead } from "./reconciler.mapper.js";
import { readBranches, readDefaultBranch, readMissed } from "./reconciler.read.js";
import { sweepMeasurements } from "./reconciler.sweep.js";

const log = createLogger("reconciler");

interface RepoTarget {
  id: string;
  fullName: string;
  githubInstallationId: string;
  branches: string[];
}

export async function reconcile(): Promise<void> {
  if (!isGitHubAppConfigured()) return;

  const repos = await prisma.repository.findMany({
    where: { enabled: true, githubInstallationId: { not: "" } },
    select: { id: true, fullName: true, githubInstallationId: true, branches: true },
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

  const reads = await resolveBranches(repo);
  if (reads.length === 0) return 0;

  const since = await computeSince(repo.id);
  let recovered = 0;
  for (const read of reads) {
    recovered += await reconcileBranch(repo, read, since);
  }
  return recovered;
}

/**
 * Which branches to read, and how, is `branchesToReconcile`'s decision. This
 * fetches what it needs: the default branch always — it is what every other
 * branch is read against — and the branch listing unless the front watches
 * every branch.
 */
async function resolveBranches(repo: RepoTarget): Promise<BranchRead[]> {
  const everything = watchesEverything(repo.branches);
  const [defaultBranch, existing] = await Promise.all([
    readDefaultBranch(repo),
    everything ? null : readBranches(repo),
  ]);
  return branchesToReconcile({ watch: repo.branches, existing, defaultBranch });
}

/**
 * Where to start reading. The newest commit already on record is the cursor; a
 * lookback floor bounds a first run (or a long outage) so catch-up cannot replay
 * an unbounded backlog of reports. Overlaps a minute against clock skew — sha
 * dedup drops anything the overlap re-reads.
 */
async function computeSince(repositoryId: string): Promise<Date> {
  const agg = await prisma.commitRecord.aggregate({
    where: { repositoryId },
    _max: { committedAt: true },
  });
  const floor = Date.now() - RECONCILE_LOOKBACK_MS;
  const cursor = agg._max.committedAt?.getTime() ?? floor;
  return new Date(Math.max(cursor - 60_000, floor));
}

async function reconcileBranch(repo: RepoTarget, read: BranchRead, since: Date): Promise<number> {
  const listed = await readMissed(repo, read, since);
  if (listed.length === 0) return 0;

  const known = await knownShas(repo.id, listed.map((commit) => commit.sha));
  const fresh = listed.filter((commit) => !known.has(commit.sha));
  if (fresh.length === 0) return 0;

  const pushes = buildSyntheticPushes(repo, read.branch, fresh);
  for (const push of pushes) {
    await enqueue({ occasion: { kind: "push", push }, repositoryId: repo.id });
  }

  log.info("recovered missed commits", {
    repo: repo.fullName,
    branch: read.branch,
    commits: fresh.length,
    pushes: pushes.length,
  });
  return fresh.length;
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
