/**
 * Writing a delivery's report record (0012): the judgement it was sent from,
 * what the model was given, the embed Discord received, and the rewrite row the
 * resend button makes of a report already sent. What these hold, and how they
 * are read back, is `report.kept.ts`.
 */

import type { Delivery as PrismaDelivery } from "@prisma/client";
import { prisma } from "@/db/prisma.js";
import { toJson } from "@/core/json.js";
import type { DiscordEmbed } from "@/integrations/discord/embed.builder.js";
import type { KeptReport } from "./report.kept.js";

/** Once per row, straight after the push is recorded: from here on it is only written and sent. */
export async function keepJudgement(id: string, kept: KeptReport): Promise<void> {
  await prisma.delivery.update({ where: { id }, data: { judgement: toJson(kept) } });
}

/** What the model was given, by which name — and, when it went out, the embed exactly as sent. */
export async function keepGeneration(
  id: string,
  generation: { systemPrompt: string; userPrompt: string; model: string; embed: DiscordEmbed | null },
): Promise<void> {
  const { systemPrompt, userPrompt, model, embed } = generation;
  await prisma.delivery.update({
    where: { id },
    data: { systemPrompt, userPrompt, model, ...(embed !== null && { embed: toJson(embed) }) },
  });
}

/**
 * A report asked for again after it was sent: a new row, pointing at the one
 * it rewrites, which keeps its text — the log never loses what the team was
 * told. It carries the same judgement, so it is written from the same facts and
 * records nothing.
 */
export async function enqueueRewrite(row: PrismaDelivery, kept: KeptReport): Promise<PrismaDelivery> {
  return prisma.delivery.create({
    data: {
      repositoryId: row.repositoryId,
      repositoryFullName: row.repositoryFullName,
      branch: row.branch,
      actorLogin: row.actorLogin,
      commitCount: row.commitCount,
      violationCount: row.violationCount,
      status: "pending",
      nextAttemptAt: new Date(),
      payload: toJson(row.payload),
      judgement: toJson({ ...kept, rewrites: row.reportText ?? "" }),
      resendOf: row.id,
    },
  });
}
