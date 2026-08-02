/**
 * The writing half of a tree sync: what actually touches rows.
 *
 * Split from the sync itself because the two answer different questions — the
 * service decides *what changed*, this decides *how a change is recorded* — and
 * the ordering constraints here (metrics before files, update rather than
 * replace) are the ones that would be broken first by a convenient edit.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma.js";
import type { TreeChanges } from "@/domain/tree/diff.js";
import type { RepoTree, RepoTreeEntry } from "@/integrations/github/commits.client.js";

/** Postgres caps a statement's bind parameters; a large repository would exceed
 *  it in a single insert, so writes go in batches rather than one heroic one. */
const WRITE_BATCH = 1_000;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/**
 * Records every blob seen, byte length included, before any tree row points at
 * it — the foreign key demands that order, and so does sense.
 *
 * `skipDuplicates` rather than an upsert: content is immutable, so a sha already
 * held is already correct, and rewriting it would risk clearing a measurement
 * that cost a request to make.
 */
export async function writeMetrics(
  tx: Prisma.TransactionClient,
  entries: RepoTreeEntry[],
): Promise<void> {
  const unique = new Map(entries.map((entry) => [entry.sha, entry.bytes]));
  const rows = [...unique].map(([sha, bytes]) => ({ sha, bytes }));

  for (const batch of chunk(rows, WRITE_BATCH)) {
    await tx.blobMetric.createMany({ data: batch, skipDuplicates: true });
  }
}

export async function writeFiles(
  tx: Prisma.TransactionClient,
  repositoryId: string,
  changes: TreeChanges<RepoTreeEntry>,
): Promise<void> {
  for (const batch of chunk(changes.added, WRITE_BATCH)) {
    await tx.treeFile.createMany({
      data: batch.map((entry) => ({ repositoryId, path: entry.path, blobSha: entry.sha })),
    });
  }

  // One statement per moved file, updating only its blob pointer: `firstSeenAt`
  // has to survive the move, which a delete-and-reinsert would destroy.
  for (const entry of changes.changed) {
    await tx.treeFile.update({
      where: { repositoryId_path: { repositoryId, path: entry.path } },
      data: { blobSha: entry.sha },
    });
  }

  for (const batch of chunk(changes.removed, WRITE_BATCH)) {
    await tx.treeFile.deleteMany({ where: { repositoryId, path: { in: batch } } });
  }
}

/** Records which listing the stored rows came from, which is what makes a later
 *  finding re-derivable rather than merely asserted. */
export function stampRepository(
  repositoryId: string,
  tree: RepoTree,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<unknown> {
  return client.repository.update({
    where: { id: repositoryId },
    data: { treeSha: tree.sha, treeSyncedAt: new Date(), treeTruncated: tree.truncated },
  });
}
