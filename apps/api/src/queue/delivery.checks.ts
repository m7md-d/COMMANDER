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
import { landingMerge, type LandingSides } from "@/domain/judgement/landing.js";
import type { TouchedFile } from "@/domain/tree/diff.js";
import { compareCommits } from "@/integrations/github/branches.client.js";
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
export async function readChanges(repository: Repository, push: NormalizedPush, knownShas: ReadonlySet<string>): Promise<ChecksFacts> {
  const config = await resolveFrontChecks(repository.id);
  const none: ChecksFacts = { config, changes: [], readings: new Map() };
  const span = pushSpan(push);
  if (!span || !repository.githubInstallationId) return none;

  const target = measureTarget(repository, config);
  const [before, after] = await Promise.all([listCommit(target, span.base), listCommit(target, span.head)]);
  if (!before || !after) return none;
  const landing = await readLanding(target, { push, knownShas, before, after });
  if (landing.status === "unreadable") return none;

  const changes = pushChanges({ before, after, push }).filter((file) => wanted(config, file.path));
  const sides = landing.status === "read" ? { ...landing.sides, branch: landing.sides.branch.filter((file) => wanted(config, file.path)) } : undefined;
  const listed = [...before, ...after, ...(landing.status === "read" ? landing.listed : [])];
  const bytes = new Map(listed.map((entry) => [entry.sha, entry.bytes]));

  const readings = await measureChanges(target, { changes: [...changes, ...(sides?.branch ?? [])], bytes }).catch((error: unknown) => {
    log.error("push measurement crashed", { repositoryId: repository.id, error: String(error) });
    return null;
  });
  return readings ? { config, changes, readings, ...(sides && { landing: sides }) } : none;
}

type LandingRead =
  | { status: "none" }
  | { status: "unreadable" }
  | { status: "read"; sides: LandingSides; listed: RepoTreeEntry[] };

/**
 * A landing merge's other side (`landingMerge`): where the branch forked, from
 * the compare API, and the listings of its fork and its head. Unreadable is not
 * "no landing": judged between the push's two ends alone, a landing charged the
 * branch's author with what main added meanwhile, so an unread one judges
 * nothing at all.
 */
async function readLanding(
  target: MeasureTarget,
  input: { push: NormalizedPush; knownShas: ReadonlySet<string>; before: RepoTreeEntry[]; after: RepoTreeEntry[] },
): Promise<LandingRead> {
  const landing = landingMerge({ push: input.push, knownShas: input.knownShas });
  if (!landing) return { status: "none" };

  const repo = { installationId: target.installationId, repoFullName: target.fullName };
  const compared = await compareCommits({ ...repo, base: landing.first, head: landing.second });
  const fork = compared.ok ? compared.data.mergeBase : null;
  const [second, forked] = await Promise.all([
    listCommit(target, landing.second),
    fork === landing.first ? input.before : fork ? listCommit(target, fork) : null,
  ]);
  if (!second || !forked) {
    log.warn("landing unreadable", { repositoryId: target.repositoryId, merge: landing.merge });
    return { status: "unreadable" };
  }

  const blobs = (listing: RepoTreeEntry[]) => new Map(listing.map((entry) => [entry.path, entry.sha]));
  const branch = pushChanges({ before: forked, after: second, push: input.push });
  const sides = { merge: landing.merge, branch, first: blobs(input.before), fork: blobs(forked), second: blobs(second), merged: blobs(input.after) };
  return { status: "read", sides, listed: [...second, ...forked] };
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
