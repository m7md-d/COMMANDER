/**
 * The last step: send the embed, then record what happened to the row.
 *
 * Split from the processor because the two decide different things — the
 * processor decides *whether and what* to report, this decides what the delivery
 * row says afterwards. Including the 429 path, where Discord dictates the retry
 * delay and the outbox must honour it instead of applying its own backoff.
 */

import type { Delivery as PrismaDelivery } from "@prisma/client";
import { sendEmbed } from "@/integrations/discord/discord.client.js";
import type { ComposedReport } from "./report.pipeline.js";
import { markFailed, markSent } from "./outbox.service.js";

export async function deliver(input: {
  job: PrismaDelivery;
  webhookUrl: string;
  composed: ComposedReport;
  violationCount: number;
}): Promise<void> {
  const { job, webhookUrl, composed, violationCount } = input;
  const delivery = await sendEmbed(webhookUrl, composed.embed);

  if (!delivery.ok) {
    await markFailed({
      id: job.id,
      attempts: job.attempts,
      reason: delivery.status === 429 ? "discord_rate_limited" : "discord_failed",
      reasonDetail:
        delivery.status === 429
          ? { seconds: delivery.retryAfterSeconds ?? 60 }
          : { status: delivery.status },
      errorMessage: delivery.error,
      retryable: delivery.retryable,
      ...(delivery.retryAfterSeconds !== undefined && {
        retryAfterSeconds: delivery.retryAfterSeconds,
      }),
    });
    return;
  }

  await markSent(job.id, {
    // Sent, but flagged so the panel shows the report was a fallback sentence.
    reason: composed.llmOk ? "ok" : "llm_failed",
    reportText: composed.reportText,
    model: composed.model,
    violationCount,
  });
}
