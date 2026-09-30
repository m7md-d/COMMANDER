import type { Delivery as PrismaDelivery } from "@prisma/client";
import type { DeliveryReason, NormalizedPush, Repository } from "@commander/shared";
import { readOccasion, resolveWatcher } from "@commander/shared";
import { fromJson } from "@/core/json.js";
import { env } from "@/config/env.js";
import { createLogger, describeError } from "@/core/logger/logger.js";
import { newCommitsBy } from "@/domain/judgement/attribution.js";
import { admitPush, judgePush, type Judgement } from "@/domain/judgement/judgement.js";
import { findByFullName } from "@/modules/repositories/repositories.service.js";
import { getDefaultPrompt, getPrompt } from "@/modules/prompts/prompts.service.js";
import { getSettings } from "@/modules/settings/settings.service.js";
import { recordPush } from "@/modules/stats/stats.service.js";
import { reviewPush } from "@/modules/review/review.service.js";
import { recordedShas } from "@/modules/dossier/dossier.ledger.js";
import { composeReport, logRuleError } from "./report.pipeline.js";
import { readChanges, refreshMeasurements, refreshTodos, refreshTree } from "./delivery.checks.js";
import { writeLedger } from "./delivery.ledger.js";
import { deliver } from "./delivery.dispatch.js";
import { processDigest } from "./digest.processor.js";
import { enrichPush, readPull } from "./push.enrich.js";
import { markFailed, markSkipped } from "./outbox.service.js";
import { keptReport, readKeptReport, type KeptReport } from "./report.kept.js";
import { keepJudgement } from "./report.record.js";

const log = createLogger("processor");

/**
 * Processes one claimed job. Never throws — a throw would strand the row.
 *
 * The payload says why the report is being written. A row that predates
 * occasions holds a bare push and is read as one, so a deploy with work already
 * in the queue loses nothing.
 */
export async function processDelivery(job: PrismaDelivery): Promise<void> {
  try {
    const occasion = readOccasion(fromJson<unknown>(job.payload));
    if (!occasion) {
      // Unreadable payloads cannot be retried into readability.
      await markSkipped(job.id, "unknown");
      return;
    }

    if (occasion.kind === "weekly_digest") await processDigest(job, occasion);
    else await run(job, occasion.push);
  } catch (error) {
    log.error("processor crashed", { id: job.id, ...describeError(error) });
    await markFailed({
      id: job.id,
      attempts: job.attempts,
      reason: "unknown",
      errorMessage: String(error),
      retryable: true,
    });
  }
}

/** A repository's own persona, or the shipped default when it has none. */
function resolvePrompt(promptId: string | null) {
  return promptId ? getPrompt(promptId) : getDefaultPrompt();
}

/**
 * A push is judged once and sent as often as it takes (0012). A row that kept
 * its judgement — a retry after Discord refused it, the resend button, a
 * rewrite — goes straight to writing and sending: judging it again recorded
 * the pusher's charges twice and told a different story (D-31).
 */
async function run(job: PrismaDelivery, received: NormalizedPush): Promise<void> {
  const kept = readKeptReport(job.judgement);
  if (kept) return send(job, kept);

  const judged = await judge(job, received);
  if (judged) await send(job, judged);
}

/**
 * Gathers the facts, does what `admitPush` and `judgePush` decide, records the
 * push and keeps its judgement on the row. Every branch acts on a decision; none
 * of them makes one. Null when the push is not to be sent, the row marked why.
 */
async function judge(job: PrismaDelivery, received: NormalizedPush): Promise<KeptReport | null> {
  const settings = await getSettings();
  if (settings.paused) return skip(job, "system_paused");

  const repository = await findByFullName(received.repoFullName);
  if (!repository) return skip(job, "repo_not_configured");

  const admission = admitPush({ repository, push: received });
  if (!admission.read) return skip(job, admission.reason);
  // Before the judging gate, not after: a push we choose not to judge still
  // moved the code, and a snapshot that skips those pushes would drift until the
  // next reconcile and blame the wrong person for what it then finds.
  const touched = await refreshTree(repository.id);
  if (!admission.judged) return skip(job, admission.reason);

  // Real file and line counts before either the rules or the report read them.
  const push = await enrichPush(repository, received);
  const [knownShas, pull] = await Promise.all([recordedShas(repository.id, push), readPull(repository, push)]);
  // The checks' evidence is what this push changed on its own branch. The
  // snapshot is the project's state — measured and noted, charged to nobody.
  const checks = await readChanges(repository, push, knownShas);
  await refreshMeasurements(repository, touched);
  // After the measurement, which is what fills in the notes it reads.
  await refreshTodos(repository.id, touched);

  const rules = { rules: repository.rules, timezoneOffset: settings.timezoneOffset, watchers: repository.watchers };
  const gates = { silentWhenClean: repository.silentWhenClean, hasChannel: webhookOf(repository) !== "" };
  const judgement = judgePush({ push, knownShas, pull, checks, ...rules, ...gates }, logRuleError);
  // Recorded whether or not it is sent: silence means "do not send", never
  // "do not remember" (0009 §5). Kept on the row, so a resend has it (0012).
  const history = await record(job, { push, knownShas, repository, judgement });
  const kept = keptReport({ push, judgement, history });
  await keepJudgement(job.id, kept);
  return judgement.withheld === null ? kept : skip(job, judgement.withheld);
}

async function skip(job: PrismaDelivery, reason: DeliveryReason): Promise<null> {
  await markSkipped(job.id, reason);
  return null;
}

/** The front's own channel, or the default. */
const webhookOf = (repository: Repository): string => repository.discordWebhookUrl || env.DISCORD_WEBHOOK_URL || "";

/**
 * Everything the push leaves behind — for every judged push, sent or not.
 *
 * Counters advance before generation so the report can cite a total that
 * includes the push being reported on.
 */
async function record(
  job: PrismaDelivery,
  ctx: { push: NormalizedPush; knownShas: ReadonlySet<string>; repository: Repository; judgement: Judgement },
): Promise<Awaited<ReturnType<typeof recordPush>>> {
  const { push, repository, judgement } = ctx;

  const history = await recordPush({
    repositoryId: repository.id,
    pusher: judgement.pusher,
    commits: newCommitsBy(push, ctx.knownShas),
    violations: judgement.violations,
    addressee: push.actorLogin,
  });

  await writeLedger({ repositoryId: repository.id, push, judgement, deliveryId: job.id });
  return history;
}

/**
 * Writing and sending, from what was kept. Nothing here judges or records: a
 * row may pass through it many times. The front is read afresh — its persona,
 * channel and pause as they are now — and the code review runs here, before
 * the model writes a word about work it would otherwise only see the titles of.
 */
async function send(job: PrismaDelivery, kept: KeptReport): Promise<void> {
  const settings = await getSettings();
  if (settings.paused) return markSkipped(job.id, "system_paused");
  const repository = await findByFullName(kept.push.repoFullName);
  if (!repository) return markSkipped(job.id, "repo_not_configured");
  const webhookUrl = webhookOf(repository);
  if (!webhookUrl) return markSkipped(job.id, "discord_missing");

  const watcher = resolveWatcher(repository.watchers, kept.push.branch);
  const { push, event, violations, commendations, history, rewrites } = kept;
  const fresh = kept.fresh ?? null;
  const [prompt, review] = await Promise.all([
    // The branch's own persona when it names one, otherwise the repository's.
    resolvePrompt(watcher.promptId ?? repository.promptId),
    reviewPush({ repository, push, fresh: fresh ?? push.commits.map((commit) => commit.sha), settings }).catch(() => null),
  ]);

  const reported = { push, event, violations, commendations, history, rewrites, fresh };
  const composed = await composeReport({ ...reported, repository, settings, watcher, prompt, review });
  await deliver({ job, webhookUrl, composed, violationCount: violations.length });
}
