/**
 * Processing one queued weekly digest.
 *
 * Same contract as the push processor: never throws, every exit writes a
 * terminal state. A digest that stranded a row in `processing` would be exactly
 * as broken as a push that did, and for the same reason.
 */

import type { Delivery as PrismaDelivery } from "@prisma/client";
import { digestTrigger, type DigestOccasion, type DigestTrigger } from "@commander/shared";
import { env } from "@/config/env.js";
import { createLogger } from "@/core/logger/logger.js";
import { toJson } from "@/core/json.js";
import { prisma } from "@/db/prisma.js";
import { requestCompletion } from "@/integrations/openrouter/openrouter.client.js";
import { getSettings } from "@/modules/settings/settings.service.js";
import { findByFullName } from "@/modules/repositories/repositories.service.js";
import { readDigestFacts } from "@/modules/digest/digest.read.js";
import { getDefaultPrompt, getPrompt } from "@/modules/prompts/prompts.service.js";
import { buildDigestEmbed, renderDigestFacts, renderDigestPrompt } from "./digest.pipeline.js";
import { assessmentFor } from "./assessment.gather.js";
import type { ComposedReport } from "./report.pipeline.js";
import { deliver } from "./delivery.dispatch.js";
import { markSkipped } from "./outbox.service.js";

const log = createLogger("digest");

export async function processDigest(
  job: PrismaDelivery,
  occasion: DigestOccasion,
): Promise<void> {
  const settings = await getSettings();
  if (settings.paused) return markSkipped(job.id, "system_paused");

  const repository = await findByFullName(occasion.repoFullName);
  if (!repository) return markSkipped(job.id, "repo_not_configured");
  if (!repository.enabled) return markSkipped(job.id, "repo_disabled");

  const webhookUrl = repository.discordWebhookUrl || env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return markSkipped(job.id, "discord_missing");

  const schedule = await prisma.reportSchedule.findUnique({
    where: { repositoryId_kind: { repositoryId: repository.id, kind: occasion.kind } },
    select: { id: true, lastState: true },
  });

  const trigger = digestTrigger(occasion);
  const facts = await readDigestFacts(
    repository.id,
    { since: new Date(occasion.since), until: new Date(occasion.until) },
    readState(schedule?.lastState),
  );

  // A silent front stays silent about a silent week. Reporting "nothing
  // happened" every Monday to a repo nobody touched is how a channel gets muted,
  // and a muted channel loses the reports that mattered too.
  //
  // A manual reading is exempt: somebody pressed a button and is waiting for an
  // answer, and "nothing happened" is the answer they asked for.
  if (repository.silentWhenClean && facts.quiet && trigger === "schedule") {
    return markSkipped(job.id, "clean_and_silent");
  }

  // Only the scheduled report owns the comparison baseline. If a manual reading
  // wrote it, the next Monday would measure its change against a Wednesday
  // afternoon and report a week's drift as a few hours of it.
  if (trigger === "schedule") await recordState(schedule?.id ?? null, facts);

  await compose(job, {
    repository,
    settings,
    facts,
    webhookUrl,
    trigger,
    assessment: await assessmentFor(repository.id, occasion, settings.reportLocale),
  });

  log.info("digest sent", { repo: repository.fullName, trigger, violations: facts.violations });
}

/**
 * Generation and delivery, split from the gates above so each half stays
 * legible: the caller decides *whether* a digest goes out, this decides what it
 * says.
 */
interface DigestContext {
  repository: NonNullable<Awaited<ReturnType<typeof findByFullName>>>;
  settings: Awaited<ReturnType<typeof getSettings>>;
  facts: Awaited<ReturnType<typeof readDigestFacts>>;
  webhookUrl: string;
  /** Carried into the embed and the prompt: a reader must be able to tell an
   *  interim reading from the weekly report at a glance, or two things that look
   *  identical will arrive in the same channel on the same day. */
  trigger: DigestTrigger;
  /** The measured evidence, already rendered. Empty when there is none, which
   *  suppresses the whole section rather than asking for one without facts. */
  assessment: string;
}

async function compose(job: PrismaDelivery, ctx: DigestContext): Promise<void> {
  const { repository, settings, facts, webhookUrl } = ctx;
  const prompt = repository.promptId
    ? await getPrompt(repository.promptId)
    : await getDefaultPrompt();

  const completion = await requestCompletion({
    model: repository.model || settings.model,
    // The front's own persona, unchanged: the weekly voice is the same voice.
    systemPrompt: prompt.system,
    userPrompt: renderDigestPrompt({
      locale: settings.reportLocale,
      facts,
      trigger: ctx.trigger,
      assessment: ctx.assessment,
    }),
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  });

  // The measured facts are the fallback. A failed generation costs the prose,
  // never the figures — which were the point of the report to begin with.
  const reportText = completion.ok
    ? completion.text
    : renderDigestFacts(settings.reportLocale, facts);

  await deliver({
    job,
    webhookUrl,
    composed: composed(ctx, reportText, completion),
    violationCount: facts.violations,
  });
}

/** The digest dressed in the shape `deliver` already knows how to record. */
function composed(
  ctx: DigestContext,
  reportText: string,
  completion: Awaited<ReturnType<typeof requestCompletion>>,
): ComposedReport {
  return {
    // A digest charges nobody: it reports a week that has already been judged
    // push by push, and counting those violations again here would double them.
    violations: [],
    reportText,
    systemPrompt: "",
    userPrompt: "",
    embed: buildDigestEmbed({
      locale: ctx.settings.reportLocale,
      repoFullName: ctx.repository.fullName,
      facts: ctx.facts,
      reportText,
      trigger: ctx.trigger,
    }),
    llmOk: completion.ok,
    llmError: completion.ok ? null : completion.error,
    llmRetryable: false,
    model: completion.model,
  };
}

/** The counts from the last digest, or nothing on the first one. */
function readState(stored: unknown): Record<string, number> {
  if (typeof stored !== "object" || stored === null) return {};

  const entries = Object.entries(stored as Record<string, unknown>);
  return Object.fromEntries(
    entries.filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );
}

/** Written after the report is composed and before it is sent: a delivery that
 *  fails and retries must compare against the same week, not against itself. */
async function recordState(
  scheduleId: string | null,
  facts: { code: { metric: string; over: number }[] },
): Promise<void> {
  if (!scheduleId) return;

  const state = Object.fromEntries(facts.code.map((entry) => [entry.metric, entry.over]));
  await prisma.reportSchedule.update({
    where: { id: scheduleId },
    data: { lastState: toJson(state) },
  });
}
