/**
 * What one delivery reads about files, in two parts that must not be confused.
 *
 * The stored snapshot is the project's state: brought up to date on every push,
 * measured, read by the panel and the digest. What the push itself changed is
 * the evidence a check may charge on, and it is read from the push's own tree
 * before and after — never from the snapshot, which follows one branch and
 * moves with whatever landed there. Judging the snapshot's movements charged
 * pushes with work done on other branches (scenarios in `checks.test.ts`).
 *
 * Split out of the processor because every step here may fail without
 * consequence: a refusal from GitHub costs the report knowledge, never the
 * communiqué. Deliberately not in `report.pipeline.ts`, which the panel's
 * preview shares: a rehearsal that rewrote the stored snapshot would be
 * indistinguishable from a real push in the record.
 */

import type { CheckConfigMap, NormalizedPush, Repository } from "@commander/shared";
import { createLogger } from "@/core/logger/logger.js";
import { wanted } from "@/domain/checks/judge.js";
import { pushChanges, pushSpan } from "@/domain/judgement/changes.js";
import type { ChecksFacts } from "@/domain/judgement/judgement.js";
import type { TouchedFile } from "@/domain/tree/diff.js";
import { fetchCommitTree, fetchRepoTree, type RepoTreeEntry } from "@/integrations/github/commits.client.js";
import { syncTree } from "@/modules/tree/tree.service.js";
import { measureChanges, measureSnapshot } from "@/modules/checks/checks.service.js";
import type { MeasureTarget } from "@/modules/checks/checks.measure.js";
import { resolveFrontChecks } from "@/modules/checks/checks.read.js";
import { syncTodos } from "@/modules/todos/todos.write.js";

const log = createLogger("processor");

/**
 * Refreshes the snapshot and returns what it moved — the project's state, for
 * the note index and the measurements behind the panel. Not evidence against
 * anyone: see `readChanges`.
 *
 * An empty list is the honest answer to every failure here. Logged rather than
 * rethrown, like the ledger write — the snapshot can be rebuilt by the next
 * push or the reconciler, the communiqué cannot.
 */
export async function refreshTree(repositoryId: string): Promise<TouchedFile[]> {
  const result = await syncTree(repositoryId).catch((error: unknown) => {
    log.error("tree sync crashed", { repositoryId, error: String(error) });
    return null;
  });

  if (result?.status === "failed") {
    log.warn("tree sync failed", { repositoryId, error: result.error });
  }

  return result?.status === "synced" ? result.touched : [];
}

/** The snapshot's measurements and baselines, brought up to date with what it moved. */
export async function refreshMeasurements(repository: Repository, touched: TouchedFile[]): Promise<void> {
  if (touched.length === 0 || !repository.githubInstallationId) return;

  // Resolved per delivery, not cached: a template edited a minute ago must apply
  // to this push, not to whatever a long-running process remembers.
  const target = measureTarget(repository, await resolveFrontChecks(repository.id));
  await measureSnapshot(target, touched).catch((error: unknown) => {
    log.error("snapshot measurement crashed", { repositoryId: repository.id, error: String(error) });
  });
}

/**
 * What this push changed on its own branch, measured: the only evidence a check
 * may charge on. Nothing on any failure, and nothing from a listing GitHub cut
 * short — a file missing from one would read as new, and a new file over the
 * limit is a crossing.
 */
export async function readChanges(repository: Repository, push: NormalizedPush): Promise<ChecksFacts> {
  const config = await resolveFrontChecks(repository.id);
  const none: ChecksFacts = { config, changes: [], readings: new Map() };
  const span = pushSpan(push);
  if (!span || !repository.githubInstallationId) return none;

  const target = measureTarget(repository, config);
  const [before, after] = await Promise.all([listCommit(target, span.base), listCommit(target, span.head)]);
  if (!before || !after) return none;

  const changes = pushChanges({ before, after, push }).filter((file) => wanted(config, file.path));
  const bytes = new Map([...before, ...after].map((entry) => [entry.sha, entry.bytes]));

  const readings = await measureChanges(target, { changes, bytes }).catch((error: unknown) => {
    log.error("push measurement crashed", { repositoryId: repository.id, error: String(error) });
    return null;
  });
  return readings ? { config, changes, readings } : none;
}

/** A commit's whole file listing, or null when it cannot be had complete. */
async function listCommit(target: MeasureTarget, commit: string): Promise<RepoTreeEntry[] | null> {
  const tree = await fetchCommitTree(target.installationId, target.fullName, commit);
  const listing = tree.ok ? await fetchRepoTree(target.installationId, target.fullName, tree.data) : tree;
  if (!listing.ok) {
    log.warn("commit tree unreadable", { repositoryId: target.repositoryId, commit, error: listing.error });
    return null;
  }
  if (listing.data.truncated) {
    log.warn("commit tree cut short", { repositoryId: target.repositoryId, commit });
    return null;
  }
  return listing.data.entries;
}

function measureTarget(repository: Repository, checks: CheckConfigMap): MeasureTarget {
  return {
    repositoryId: repository.id,
    fullName: repository.fullName,
    installationId: repository.githubInstallationId,
    checks,
  };
}

/**
 * Brings the note index in step with what the snapshot moved.
 *
 * Its own step rather than part of the measurements, because it is not a
 * judgement: nothing here is charged to anybody, and a failure costs a report
 * some context rather than costing somebody a finding. Logged and swallowed.
 */
export async function refreshTodos(repositoryId: string, touched: TouchedFile[]): Promise<void> {
  if (touched.length === 0) return;

  await syncTodos(
    repositoryId,
    touched.map((file) => file.path),
  ).catch((error: unknown) => {
    log.warn("note index failed", { repositoryId, error: String(error) });
  });
}
