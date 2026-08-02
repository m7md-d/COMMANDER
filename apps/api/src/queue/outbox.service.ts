import type { Delivery as PrismaDelivery } from "@prisma/client";
import {
  MAX_RETRY_ATTEMPTS,
  NON_RETRYABLE_REASONS,
  retryDelayMs,
  type DeliveryReason,
  type Occasion,
  type RuleDetail,
} from "@commander/shared";
import { JOB_LOCK_TIMEOUT_MS } from "@/config/constants.js";
import { prisma } from "@/db/prisma.js";
import { createLogger } from "@/core/logger/logger.js";
import { toJson } from "@/core/json.js";

const log = createLogger("outbox");

/**
 * Queues an occasion — a push that arrived, or a week that ended.
 *
 * Both go in the same table on purpose: retry, backoff, orphan recovery and
 * "nothing is ever lost" are already solved here, and a second delivery path for
 * time-triggered reports would mean solving all four again, worse.
 */
export async function enqueue(input: {
  occasion: Occasion;
  repositoryId: string | null;
}): Promise<PrismaDelivery> {
  const { occasion, repositoryId } = input;
  const push = occasion.kind === "push" ? occasion.push : null;
  const fullName = occasion.kind === "push" ? occasion.push.repoFullName : occasion.repoFullName;

  return prisma.delivery.create({
    data: {
      repositoryId,
      repositoryFullName: fullName,
      // A digest belongs to no branch and to nobody in particular; leaving these
      // empty is the honest answer, and the log reads correctly either way.
      branch: push?.branch ?? "",
      actorLogin: push?.actorLogin ?? "",
      commitCount: push?.commits.length ?? 0,
      status: "pending",
      nextAttemptAt: new Date(),
      // The whole occasion is persisted so a retry needs nothing from GitHub —
      // the original delivery is long gone by then, and a digest retried three
      // hours later must still report the week it was queued for.
      payload: toJson(occasion),
    },
  });
}

/**
 * Claims jobs with `FOR UPDATE SKIP LOCKED`.
 *
 * This is what makes the queue safe to run with more than one API replica: two
 * workers polling at the same instant take disjoint rows instead of both
 * grabbing the same one. Prisma has no first-class support for it, so the claim
 * is raw SQL and the follow-up read goes through the client.
 */
export async function claimBatch(batchSize: number): Promise<PrismaDelivery[]> {
  const staleBefore = new Date(Date.now() - JOB_LOCK_TIMEOUT_MS);

  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE deliveries
       SET status = 'processing',
           locked_at = NOW(),
           attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM deliveries
        WHERE (status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()))
           OR (status = 'processing' AND locked_at < ${staleBefore})
        ORDER BY created_at ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING id
  `;

  if (claimed.length === 0) return [];

  return prisma.delivery.findMany({ where: { id: { in: claimed.map((row) => row.id) } } });
}

export async function markSent(id: string, patch: {
  reason: DeliveryReason;
  reportText: string;
  model: string;
  violationCount: number;
}): Promise<void> {
  await prisma.delivery.update({
    where: { id },
    data: {
      status: "sent",
      reason: patch.reason,
      reportText: patch.reportText,
      model: patch.model,
      violationCount: patch.violationCount,
      completedAt: new Date(),
      nextAttemptAt: null,
      lockedAt: null,
      errorMessage: null,
    },
  });
}

/** Terminal, not an error: the push was received and deliberately not reported. */
export async function markSkipped(id: string, reason: DeliveryReason): Promise<void> {
  await prisma.delivery.update({
    where: { id },
    data: {
      status: "skipped",
      reason,
      completedAt: new Date(),
      nextAttemptAt: null,
      lockedAt: null,
    },
  });
}

/**
 * Decides between another attempt and giving up. A job stops retrying when the
 * reason cannot change (a deleted webhook, an unregistered repository) or when
 * the attempt budget is spent — retrying past either point only burns quota.
 */
export async function markFailed(input: {
  id: string;
  attempts: number;
  reason: DeliveryReason;
  reasonDetail?: RuleDetail;
  errorMessage: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}): Promise<void> {
  const { id, attempts, reason, errorMessage, retryable } = input;

  const exhausted = attempts >= MAX_RETRY_ATTEMPTS;
  const terminal = !retryable || NON_RETRYABLE_REASONS.includes(reason) || exhausted;

  const delayMs = input.retryAfterSeconds
    ? input.retryAfterSeconds * 1_000
    : retryDelayMs(attempts);

  await prisma.delivery.update({
    where: { id },
    data: {
      status: terminal ? "failed" : "pending",
      reason,
      reasonDetail: toJson(input.reasonDetail ?? {}),
      errorMessage: errorMessage.slice(0, 500),
      nextAttemptAt: terminal ? null : new Date(Date.now() + delayMs),
      lockedAt: null,
      ...(terminal && { completedAt: new Date() }),
    },
  });

  log.warn("delivery attempt failed", { id, attempts, reason, terminal });
}

/**
 * At startup a single-node worker owns no in-flight jobs, so any row still in
 * `processing` was interrupted by a crash (a closed lid, `kill -9`, power loss)
 * — a graceful shutdown would have finished it or never left it locked. Reclaim
 * them at once instead of waiting out JOB_LOCK_TIMEOUT_MS, and refund the single
 * attempt the claim consumed but never spent, so a crash costs no retry budget.
 * A `processing` row always has attempts >= 1 (claimBatch increments on claim),
 * so the decrement cannot go negative.
 */
export async function recoverOrphans(): Promise<number> {
  const { count } = await prisma.delivery.updateMany({
    where: { status: "processing" },
    data: {
      status: "pending",
      nextAttemptAt: new Date(),
      lockedAt: null,
      attempts: { decrement: 1 },
    },
  });
  return count;
}

/** Manual re-queue from the panel. Resets the budget deliberately. */
export async function requeue(id: string): Promise<void> {
  await prisma.delivery.update({
    where: { id },
    data: { status: "pending", attempts: 0, nextAttemptAt: new Date(), lockedAt: null },
  });
}

export async function prune(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const { count } = await prisma.delivery.deleteMany({
    where: { createdAt: { lt: cutoff }, status: { in: ["sent", "skipped", "failed"] } },
  });
  return count;
}
