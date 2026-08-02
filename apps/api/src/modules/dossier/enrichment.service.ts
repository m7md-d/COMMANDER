/**
 * Turns webhook-grade data into dossier-grade data using the GitHub API.
 *
 * Everything here is best-effort by design. The push webhook already produced a
 * report; enrichment only deepens the record. A missing App, a rate limit or a
 * deleted commit must degrade the dossier, never fail a delivery.
 */

import { prisma } from "@/db/prisma.js";
import { createLogger } from "@/core/logger/logger.js";
import {
  fetchCommitDetail,
  fetchRepoFile,
  type CommitDetail,
} from "@/integrations/github/github.client.js";
import { isGitHubAppConfigured } from "@/integrations/github/app-auth.js";

const log = createLogger("enrichment");

/** Paths searched, in order, for the watched repo's own rules. */
export const CONSTITUTION_CANDIDATES = [
  "CONSTITUTION.md",
  "docs/CONSTITUTION.md",
  "CONTRIBUTING.md",
  ".github/CONTRIBUTING.md",
];

const MAX_DOCUMENT_CHARS = 40_000;

/**
 * Fills in line counts for commits stored without them, and accumulates
 * per-file ownership. Bounded per run so one huge backlog cannot monopolise
 * the worker or the API rate limit.
 */
export async function enrichPendingCommits(repositoryId: string, limit = 20): Promise<number> {
  if (!isGitHubAppConfigured()) return 0;

  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository?.githubInstallationId) return 0;

  const pending = await prisma.commitRecord.findMany({
    where: { repositoryId, enriched: false },
    orderBy: { committedAt: "desc" },
    take: limit,
  });

  let enriched = 0;

  for (const commit of pending) {
    const result = await fetchCommitDetail(
      repository.githubInstallationId,
      repository.fullName,
      commit.sha,
    );

    if (!result.ok) {
      // A rebased or force-pushed-away sha will never resolve. Marking it
      // enriched stops us asking forever; retrying it every cycle would burn
      // the rate limit on a commit that no longer exists.
      if (result.notFound) {
        await prisma.commitRecord.update({
          where: { id: commit.id },
          data: { enriched: true },
        });
      }
      continue;
    }

    await applyCommitDetail({
      repositoryId,
      commitRecordId: commit.id,
      login: commit.login,
      detail: result.data,
    });
    enriched += 1;
  }

  if (enriched > 0) log.info("commits enriched", { repositoryId, enriched });
  return enriched;
}

async function applyCommitDetail(input: {
  repositoryId: string;
  commitRecordId: string;
  login: string;
  /** The client's own type, not a restatement of it: a second structural copy
   *  keeps compiling after the real one gains a field, and quietly ignores it. */
  detail: CommitDetail;
}): Promise<void> {
  const { repositoryId, commitRecordId, login, detail } = input;
  await prisma.$transaction(async (tx) => {
    await tx.commitRecord.update({
      where: { id: commitRecordId },
      data: {
        additions: detail.additions,
        deletions: detail.deletions,
        filesChanged: detail.files.length,
        enriched: true,
      },
    });

    for (const file of detail.files) {
      await tx.fileAttribution.upsert({
        where: { repositoryId_login_path: { repositoryId, login, path: file.path } },
        create: {
          repositoryId,
          login,
          path: file.path,
          linesAdded: file.additions,
          linesRemoved: file.deletions,
          commitCount: 1,
          lastTouchedAt: new Date(),
        },
        update: {
          linesAdded: { increment: file.additions },
          linesRemoved: { increment: file.deletions },
          commitCount: { increment: 1 },
          lastTouchedAt: new Date(),
        },
      });
    }
  });
}

/**
 * Caches the watched repository's own rules document.
 *
 * The blob sha is the invalidation signal: unchanged sha means unchanged
 * content, so the stored copy can never silently go stale against the repo —
 * which is precisely the data rot this system is meant to resist.
 */
export async function syncRepoConstitution(repositoryId: string): Promise<boolean> {
  if (!isGitHubAppConfigured()) return false;

  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository?.githubInstallationId) return false;

  for (const path of CONSTITUTION_CANDIDATES) {
    const result = await fetchRepoFile(
      repository.githubInstallationId,
      repository.fullName,
      path,
    );

    if (!result.ok) {
      if (result.notFound) continue;
      return false;
    }

    const existing = await prisma.repoDocument.findUnique({
      where: { repositoryId_path: { repositoryId, path } },
    });

    if (existing?.sha === result.data.sha) return true;

    await prisma.repoDocument.upsert({
      where: { repositoryId_path: { repositoryId, path } },
      create: {
        repositoryId,
        path,
        sha: result.data.sha,
        content: result.data.content.slice(0, MAX_DOCUMENT_CHARS),
      },
      update: {
        sha: result.data.sha,
        content: result.data.content.slice(0, MAX_DOCUMENT_CHARS),
        fetchedAt: new Date(),
      },
    });

    log.info("constitution synced", { repositoryId, path });
    return true;
  }

  return false;
}

/**
 * The cached rules document. Filtered by path rather than taking the newest row:
 * RepoDocument also holds derived artefacts (the structure digest), and an
 * unfiltered read would hand the model a JSON blob as if it were the rules.
 */
export async function readRepoConstitution(repositoryId: string): Promise<string | null> {
  const document = await prisma.repoDocument.findFirst({
    where: { repositoryId, path: { in: CONSTITUTION_CANDIDATES } },
    orderBy: { fetchedAt: "desc" },
  });
  return document?.content ?? null;
}
