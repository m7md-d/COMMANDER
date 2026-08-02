/**
 * Keeps a repository's stored file tree in step with GitHub.
 *
 * The snapshot is read from one recursive tree listing — a single request
 * whatever the project's size — but it is *written* differentially: a row whose
 * blob did not move is not touched. That is not an optimisation. `firstSeenAt`
 * is the anchor a baseline will be drawn from, and deleting and re-inserting
 * every row on each push would reset it, quietly turning code that predates the
 * platform into work somebody did today.
 *
 * Returns a result rather than throwing on a network failure (§6): a refusal
 * from GitHub leaves the last good snapshot in place, which is a better answer
 * than a half-written one.
 */

import { prisma } from "@/db/prisma.js";
import { createLogger } from "@/core/logger/logger.js";
import { NotFoundError } from "@/core/errors/app-error.js";
import { isGitHubAppConfigured } from "@/integrations/github/app-auth.js";
import {
  fetchDefaultBranch,
  fetchRepoTree,
  type RepoTree,
  type RepoTreeEntry,
} from "@/integrations/github/commits.client.js";
import { diffTree, type TouchedFile, type TreeChanges } from "@/domain/tree/diff.js";
import { stampRepository, writeFiles, writeMetrics } from "./tree.write.js";

const log = createLogger("tree");

export type TreeSyncResult =
  | { status: "unavailable" }
  | { status: "failed"; error: string }
  | {
      status: "synced";
      /** The listing this snapshot came from — the digest is cached against it,
       *  so an unchanged tree costs one request and no rewrite. */
      treeSha: string;
      files: number;
      added: number;
      changed: number;
      removed: number;
      truncated: boolean;
      /** Every stored path after the sync. The layout digest is derived from
       *  these rows rather than from a second listing, so the digest and the
       *  chart can never end up describing two different trees. */
      paths: string[];
      /** What moved, each with the blob it moved from. Carried out of the sync
       *  because the old sha is gone from the table the moment it writes, and a
       *  check cannot tell a crossing from an inheritance without it. */
      touched: TouchedFile[];
    };

export async function syncTree(repositoryId: string): Promise<TreeSyncResult> {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { fullName: true, branches: true, githubInstallationId: true, treeSha: true },
  });
  if (!repository) throw new NotFoundError("repos.notFound");

  const installationId = repository.githubInstallationId;
  if (!isGitHubAppConfigured() || !installationId) return { status: "unavailable" };

  const branch = await resolveBranch(installationId, repository.fullName, repository.branches);
  if (!branch) return { status: "unavailable" };

  const tree = await fetchRepoTree(installationId, repository.fullName, branch);
  if (!tree.ok) return { status: "failed", error: tree.error };

  return store(repositoryId, tree.data, repository.treeSha);
}

/**
 * A concrete watched branch, or the repo's default when it watches everything or
 * only wildcards — the tree API needs a real ref, which a wildcard is not.
 */
export async function resolveBranch(
  installationId: string,
  fullName: string,
  branches: string[],
): Promise<string | null> {
  const concrete = branches.find((branch) => branch.length > 0 && !branch.includes("*"));
  if (concrete) return concrete;

  const meta = await fetchDefaultBranch(installationId, fullName);
  return meta.ok && meta.data ? meta.data : null;
}

async function store(
  repositoryId: string,
  tree: RepoTree,
  knownSha: string,
): Promise<TreeSyncResult> {
  const stored = await prisma.treeFile.findMany({
    where: { repositoryId },
    select: { path: true, blobSha: true },
  });

  // The tree sha is a hash of the whole listing, so an unchanged sha proves that
  // no file moved — stamping the time without rewriting a row is exactly what
  // keying on content buys. Guarded on rows existing, because a matching sha
  // over an empty table means an earlier sync was interrupted.
  if (tree.sha === knownSha && stored.length > 0) {
    await stampRepository(repositoryId, tree);
    return unchanged(stored.map((row) => row.path), tree);
  }

  const changes = diffTree(stored, tree.entries);
  await commit(repositoryId, tree, changes);

  log.info("tree synced", {
    repositoryId,
    files: tree.entries.length,
    added: changes.added.length,
    changed: changes.changed.length,
    removed: changes.removed.length,
  });

  return {
    status: "synced",
    treeSha: tree.sha,
    files: tree.entries.length,
    added: changes.added.length,
    changed: changes.changed.length,
    removed: changes.removed.length,
    truncated: tree.truncated,
    paths: tree.entries.map((entry) => entry.path),
    touched: changes.touched,
  };
}

/** One transaction, so a crash never leaves half a snapshot behind. */
function commit(
  repositoryId: string,
  tree: RepoTree,
  changes: TreeChanges<RepoTreeEntry>,
): Promise<unknown> {
  return prisma.$transaction(
    async (tx) => {
      await writeMetrics(tx, tree.entries);
      await writeFiles(tx, repositoryId, changes);
      await stampRepository(repositoryId, tree, tx);
    },
    // A first sync of a large repository is thousands of rows; the default five
    // seconds would abort it and leave the snapshot unbuilt on every attempt.
    { timeout: 60_000 },
  );
}

function unchanged(paths: string[], tree: RepoTree): TreeSyncResult {
  return {
    status: "synced",
    treeSha: tree.sha,
    files: paths.length,
    added: 0,
    changed: 0,
    removed: 0,
    truncated: tree.truncated,
    paths,
    // An unchanged tree sha means nothing moved, so nothing is up for judgement.
    touched: [],
  };
}
