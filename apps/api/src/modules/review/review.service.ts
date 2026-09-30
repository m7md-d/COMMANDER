/**
 * The code review of one push (0009 §7): its net diff, judged by a model before
 * the communiqué is written, so the report can speak to what is in the code and
 * not only to commit titles.
 *
 * Once per push and only when asked for. The setting is off until someone
 * chooses its price — a model request for each push that brought new work —
 * and the review is kept by the push's head, so a retry or a resend of the same
 * report reads it back instead of paying again. What is reviewed, and under
 * whose name, is `reviewTarget`'s to say. Gated like enrichment: a missing App,
 * a rate limit or a retired model leaves the report without a review, never
 * without a report.
 */

import {
  commitReviewSchema,
  DEFAULT_REVIEW_PROMPT,
  parseCommitReview,
  type CommitReview,
  type NormalizedPush,
  type Settings,
} from "@commander/shared";
import { env } from "@/config/env.js";
import { toJson } from "@/core/json.js";
import { createLogger } from "@/core/logger/logger.js";
import { prisma } from "@/db/prisma.js";
import { reviewTarget, type ReviewTarget } from "@/domain/review/target.js";
import { isGitHubAppConfigured } from "@/integrations/github/app-auth.js";
import { fetchCompareDiff } from "@/integrations/github/compare.client.js";
import { requestCompletion } from "@/integrations/openrouter/openrouter.client.js";
import { readStructureDigest } from "@/modules/repositories/scan.service.js";
import { buildReviewPrompt } from "./review.build.js";

const log = createLogger("review");

interface ReviewScope {
  repository: { id: string; fullName: string; githubInstallationId: string; model: string };
  push: NormalizedPush;
  /** The shas the push brought the record (`Judgement.fresh`). */
  fresh: readonly string[];
  settings: Settings;
}

/** The push's review — kept, or asked for now — or null when there is none to give. */
export async function reviewPush(scope: ReviewScope): Promise<CommitReview | null> {
  const { repository, settings } = scope;
  if (!settings.review || !isGitHubAppConfigured() || !env.OPENROUTER_API_KEY || !repository.githubInstallationId) return null;

  const target = reviewTarget(scope);
  if (!target) return null;

  const kept = await prisma.pushReview.findUnique({
    where: { repositoryId_head: { repositoryId: repository.id, head: target.head } },
    select: { review: true },
  });
  if (kept) {
    const parsed = commitReviewSchema.safeParse(kept.review);
    return parsed.success ? parsed.data : null;
  }
  return askFor({ ...scope, target });
}

async function askFor(scope: ReviewScope & { target: ReviewTarget }): Promise<CommitReview | null> {
  const { repository, target } = scope;
  const diff = await fetchCompareDiff({ installationId: repository.githubInstallationId, repoFullName: repository.fullName, base: target.base, head: target.head });
  if (!diff.ok) {
    log.warn("push diff unread", { repositoryId: repository.id, head: target.head, error: diff.error });
    return null;
  }

  const structure = await readStructureDigest(repository.id).catch(() => null);
  const model = repository.model || scope.settings.model;
  const completion = await requestCompletion({
    model,
    systemPrompt: DEFAULT_REVIEW_PROMPT,
    userPrompt: buildReviewPrompt({ title: target.title, authorLogin: target.authors.join(", "), detail: diff.data, structure }),
    temperature: 0.4,
    maxTokens: 500,
  });
  // A transient failure is left for the next send rather than keeping nothing
  // against a push the model could judge fine next time.
  if (!completion.ok) return null;

  const review = parseCommitReview(completion.text);
  if (review) await keep({ repositoryId: repository.id, target, review, model: completion.model });
  return review;
}

/** Kept by the push's head; two sends racing for one push keep the first. */
async function keep(input: { repositoryId: string; target: ReviewTarget; review: CommitReview; model: string }): Promise<void> {
  const { repositoryId, target, review, model } = input;
  await prisma.pushReview.upsert({
    where: { repositoryId_head: { repositoryId, head: target.head } },
    create: { repositoryId, head: target.head, login: target.login, title: target.title, review: toJson(review), model },
    update: {},
  });
}
