/**
 * The last step: send the embed, then record what happened to the row.
 *
 * Split from the processor because the two decide different things — the
 * processor decides *whether and what* to report, this decides what the delivery
 * row says afterwards. Including the 429 path, where Discord dictates the retry
 * delay and the outbox must honour it instead of applying its own backoff.
 */

import type { Delivery as PrismaDelivery } from "@prisma/client";
import { sendEmbed, type DiscordResult } from "@/integrations/discord/discord.client.js";
import type { ComposedReport } from "./report.pipeline.js";
import { afterGeneration } from "@/domain/report/generation.js";
import { markFailed, markSent } from "./outbox.service.js";
import { keepGeneration } from "./report.record.js";

export async function deliver(input: {
  job: PrismaDelivery;
  webhookUrl: string;
  composed: ComposedReport;
  violationCount: number;
}): Promise<void> {
  const { job, webhookUrl, composed, violationCount } = input;
  const given = { systemPrompt: composed.systemPrompt, userPrompt: composed.userPrompt, model: composed.model };

  // A report the model did not write is never replaced by a sentence (0012):
  // retried while waiting can mend it, then held for the resend button.
  const next = afterGeneration(composed);
  if (!next.send) {
    await keepGeneration(job.id, { ...given, embed: null });
    await markFailed({
      id: job.id,
      attempts: job.attempts,
      reason: next.reason,
      errorMessage: next.error,
      retryable: next.retryable,
      ...(next.retryAfterSeconds !== undefined && { retryAfterSeconds: next.retryAfterSeconds }),
      ...(next.detail !== undefined && { reasonDetail: next.detail }),
    });
    return;
  }

  const delivery = await sendEmbed(webhookUrl, composed.embed);
  await keepGeneration(job.id, { ...given, embed: delivery.ok ? composed.embed : null });

  if (!delivery.ok) return refused(job, delivery);

  await markSent(job.id, { reason: next.reason, reportText: composed.reportText, model: composed.model, violationCount });
}

/** Discord said no: how long it asked us to wait, or why it will not take this at all. */
function refused(job: PrismaDelivery, delivery: Extract<DiscordResult, { ok: false }>): Promise<void> {
  const limited = delivery.status === 429;
  return markFailed({
    id: job.id,
    attempts: job.attempts,
    reason: limited ? "discord_rate_limited" : "discord_failed",
    reasonDetail: { ...delivery.failure, ...(limited ? { seconds: delivery.retryAfterSeconds ?? 60 } : { status: delivery.status }) },
    errorMessage: delivery.error,
    retryable: delivery.retryable,
    ...(delivery.retryAfterSeconds !== undefined && { retryAfterSeconds: delivery.retryAfterSeconds }),
  });
}
