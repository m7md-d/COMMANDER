/**
 * Repository reconnaissance: read an existing project once, and learn what the
 * platform would otherwise only discover push by push.
 *
 * This is what makes the panel usable against a repository with ten years of
 * history rather than only a fresh one — it imports the people who actually
 * wrote it and the shape of what they wrote, so the very first communiqué is
 * informed instead of blind.
 *
 * Every step is independent and best-effort: contributors can import even when
 * the tree call fails, and neither failure is allowed to abort the other.
 */

import {
  structureDigestSchema,
  summarizeStructure,
  type StructureDigest,
} from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { createLogger } from "@/core/logger/logger.js";
import { NotFoundError } from "@/core/errors/app-error.js";
import { isGitHubAppConfigured } from "@/integrations/github/app-auth.js";
import { fetchContributors } from "@/integrations/github/commits.client.js";
import { syncTree, type TreeSyncResult } from "@/modules/tree/tree.service.js";

const log = createLogger("scan");

/** Reserved RepoDocument path. Not a file in the repo — a derived artefact kept
 *  beside the cached documents because it invalidates the same way, by sha. */
export const STRUCTURE_PATH = "__structure__";

export interface ScanResult {
  /** False when the App is unconfigured or the repo has no installation id. */
  available: boolean;
  membersImported: number;
  filesSeen: number;
  areas: number;
  truncated: boolean;
}

export async function scanRepository(repositoryId: string): Promise<ScanResult> {
  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository) throw new NotFoundError("repos.notFound");

  const empty: ScanResult = {
    available: false,
    membersImported: 0,
    filesSeen: 0,
    areas: 0,
    truncated: false,
  };
  if (!isGitHubAppConfigured() || !repository.githubInstallationId) return empty;

  // The tree sync is the one that reads the file listing; the digest is then
  // derived from the rows it stored rather than from a second request, so the
  // survey and the chart cannot end up describing different trees.
  const [membersImported, sync] = await Promise.all([
    importContributors(repository.id, repository.githubInstallationId, repository.fullName),
    syncTree(repository.id),
  ]);
  const structure = await cacheDigest(repository.id, sync);

  // Stamped only on a pass that actually reached GitHub, so the panel's "last
  // scan" is a record of contact rather than of a button press.
  await prisma.repository.update({
    where: { id: repositoryId },
    data: { lastScannedAt: new Date() },
  });

  log.info("repository scanned", { repositoryId, membersImported, files: structure?.totalFiles });

  return {
    available: true,
    membersImported,
    filesSeen: structure?.totalFiles ?? 0,
    areas: structure?.areas.length ?? 0,
    truncated: structure?.truncated ?? false,
  };
}

/**
 * Upserts every human contributor. Existing rows keep the operator's own
 * display name, rank and note — a scan enriches the roster, it never overwrites
 * the curation that makes the reports personal.
 */
async function importContributors(
  repositoryId: string,
  installationId: string,
  fullName: string,
): Promise<number> {
  const result = await fetchContributors(installationId, fullName);
  if (!result.ok) return 0;

  let imported = 0;
  for (const contributor of result.data) {
    await prisma.member.upsert({
      where: { repositoryId_login: { repositoryId, login: contributor.login } },
      create: {
        repositoryId,
        login: contributor.login,
        displayName: contributor.login,
        avatarUrl: contributor.avatarUrl,
      },
      update: { avatarUrl: contributor.avatarUrl },
    });
    imported += 1;
  }

  return imported;
}

/**
 * Compresses the stored rows into the digest the report prompt carries, cached
 * against the tree sha so an unchanged tree costs no rewrite.
 *
 * Returns null when the sync did not happen — a stale digest is better than one
 * that claims a project has no files because GitHub refused a request.
 */
async function cacheDigest(
  repositoryId: string,
  sync: TreeSyncResult,
): Promise<StructureDigest | null> {
  if (sync.status !== "synced") return null;

  const digest = summarizeStructure(sync.paths, sync.truncated);
  const content = JSON.stringify(digest);

  await prisma.repoDocument.upsert({
    where: { repositoryId_path: { repositoryId, path: STRUCTURE_PATH } },
    create: { repositoryId, path: STRUCTURE_PATH, sha: sync.treeSha, content },
    update: { sha: sync.treeSha, content, fetchedAt: new Date() },
  });

  return digest;
}

/** The cached layout, for the report prompt. Null before the first scan. */
export async function readStructureDigest(
  repositoryId: string,
): Promise<StructureDigest | null> {
  const row = await prisma.repoDocument.findUnique({
    where: { repositoryId_path: { repositoryId, path: STRUCTURE_PATH } },
  });
  if (!row) return null;

  try {
    return structureDigestSchema.parse(JSON.parse(row.content));
  } catch {
    // A digest written by an older shape is worth less than a stated absence.
    return null;
  }
}
