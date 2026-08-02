/**
 * The code-review pass: fetch a commit's diff, ask the model to judge it, store
 * the verdict on the commit record. Gated exactly like enrichment — a missing
 * App, a rate limit or a retired model must degrade the dossier, never fail
 * anything. Off the hot path: it runs on the maintenance cycle, not per push.
 */

import {
  commitReviewSchema,
  DEFAULT_REVIEW_PROMPT,
  parseCommitReview,
  type CommitReview,
  type StructureDigest,
} from "@commander/shared";
import type { ReviewedCommit } from "@/domain/report/prompt-builder.js";
import { readStructureDigest } from "@/modules/repositories/scan.service.js";
import { env } from "@/config/env.js";
import { prisma } from "@/db/prisma.js";
import { createLogger } from "@/core/logger/logger.js";
import { toJson } from "@/core/json.js";
import { isGitHubAppConfigured } from "@/integrations/github/app-auth.js";
import { fetchCommitDetail } from "@/integrations/github/github.client.js";
import { requestCompletion } from "@/integrations/openrouter/openrouter.client.js";
import { getSettings } from "@/modules/settings/settings.service.js";
import { buildReviewPrompt } from "./review.build.js";

const log = createLogger("review");

/**
 * Reviews commits that carry no verdict yet. Bounded per run so one large
 * backlog cannot monopolise the model quota or the maintenance tick.
 */
export async function reviewPendingCommits(repositoryId: string, limit = 10): Promise<number> {
  if (!isGitHubAppConfigured() || !env.OPENROUTER_API_KEY) return 0;

  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository?.githubInstallationId) return 0;

  const pending = await prisma.commitRecord.findMany({
    where: { repositoryId, reviewedAt: null },
    orderBy: { committedAt: "desc" },
    take: limit,
  });
  if (pending.length === 0) return 0;

  const settings = await getSettings();
  const model = repository.model || settings.model;
  let reviewed = 0;

  for (const commit of pending) {
    if (
      await reviewOne({
        installationId: repository.githubInstallationId,
        repoFullName: repository.fullName,
        model,
        commit,
      })
    ) {
      reviewed += 1;
    }
  }

  if (reviewed > 0) log.info("commits reviewed", { repositoryId, reviewed });
  return reviewed;
}

/**
 * The verdicts for one push, reviewing whatever has not been judged yet.
 *
 * Runs before the communiqué rather than on the hourly cycle, because a report
 * that cannot see the code can only comment on commit titles — the difference
 * between a joke and an audit. Cost stays bounded by the sha dedup: a commit is
 * reviewed once in its life no matter how many reports cite it.
 */
export async function reviewPushCommits(
  repositoryId: string,
  shas: string[],
): Promise<ReviewedCommit[]> {
  if (!isGitHubAppConfigured() || !env.OPENROUTER_API_KEY || shas.length === 0) return [];

  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository?.githubInstallationId) return [];

  const records = await prisma.commitRecord.findMany({ where: { repositoryId, sha: { in: shas } } });
  if (records.length === 0) return [];

  const [settings, structure] = await Promise.all([
    getSettings(),
    readStructureDigest(repositoryId).catch(() => null),
  ]);
  const model = repository.model || settings.model;
  const reviewed: ReviewedCommit[] = [];

  for (const record of records) {
    const review = record.reviewedAt
      ? readStoredReview(record.review)
      : await reviewOne({
          installationId: repository.githubInstallationId,
          repoFullName: repository.fullName,
          model,
          commit: record,
          structure,
        });

    if (review) reviewed.push({ title: record.title, ...review });
  }

  return reviewed;
}

/** A stored verdict is JSON, so it is validated rather than trusted on read. */
function readStoredReview(stored: unknown): CommitReview | null {
  const parsed = commitReviewSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

/**
 * Reviews one commit and returns the verdict it stored, or null when there is
 * none to store — an unresolvable sha, or a model that failed this time round.
 */
async function reviewOne(input: {
  installationId: string;
  repoFullName: string;
  model: string;
  commit: { id: string; sha: string; title: string; login: string };
  structure?: StructureDigest | null;
}): Promise<CommitReview | null> {
  const { installationId, repoFullName, model, commit, structure = null } = input;
  const detail = await fetchCommitDetail(installationId, repoFullName, commit.sha);

  if (!detail.ok) {
    // A rebased or force-pushed-away sha will never resolve — record the attempt
    // with no verdict so we stop asking, exactly as enrichment does.
    if (detail.notFound) await storeReview(commit.id, null, model);
    return null;
  }

  const completion = await requestCompletion({
    model,
    systemPrompt: DEFAULT_REVIEW_PROMPT,
    userPrompt: buildReviewPrompt({
      title: commit.title,
      authorLogin: commit.login,
      detail: detail.data,
      structure,
    }),
    temperature: 0.4,
    maxTokens: 500,
  });

  // A transient model failure is left for the next cycle rather than burning a
  // neutral verdict onto a commit the model could judge fine next time.
  if (!completion.ok) return null;

  const review = parseCommitReview(completion.text);
  await storeReview(commit.id, review, completion.model);
  return review;
}

/**
 * Records the outcome. A null review (unresolvable sha, or output that was not
 * valid JSON) is stored as an empty object: `reviewedAt` still advances so the
 * commit is not retried, and the dossier read drops anything that fails to
 * validate rather than showing a verdict-less row.
 */
async function storeReview(
  id: string,
  review: CommitReview | null,
  model: string,
): Promise<void> {
  await prisma.commitRecord.update({
    where: { id },
    data: {
      review: toJson(review ?? {}),
      reviewModel: model,
      reviewedAt: new Date(),
    },
  });
}
