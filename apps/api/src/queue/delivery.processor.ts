import type { Delivery as PrismaDelivery } from "@prisma/client";
import type {
  Commendation,
  NormalizedPush,
  Repository,
  Settings,
  ViolationHit,
  Watcher,
} from "@commander/shared";
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
import { reviewPushCommits } from "@/modules/dossier/review.service.js";
import { recordedShas } from "@/modules/dossier/dossier.ledger.js";
import { composeReport, logRuleError } from "./report.pipeline.js";
import { readChanges, refreshMeasurements, refreshTodos, refreshTree } from "./delivery.checks.js";
import { writeLedger } from "./delivery.ledger.js";
import { deliver } from "./delivery.dispatch.js";
import { processDigest } from "./digest.processor.js";
import { enrichPush, readPull } from "./push.enrich.js";
import { markFailed, markSkipped } from "./outbox.service.js";

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
 * Gathers the facts and does what `admitPush` and `judgePush` decide. Every
 * branch below acts on a decision; none of them makes one.
 */
async function run(job: PrismaDelivery, received: NormalizedPush): Promise<void> {
  const settings = await getSettings();
  if (settings.paused) return markSkipped(job.id, "system_paused");

  const repository = await findByFullName(received.repoFullName);
  if (!repository) return markSkipped(job.id, "repo_not_configured");

  const admission = admitPush({ repository, push: received });
  if (!admission.read) return markSkipped(job.id, admission.reason);
  // Before the judging gate, not after: a push we choose not to judge still
  // moved the code, and a snapshot that skips those pushes would drift until the
  // next reconcile and blame the wrong person for what it then finds.
  const touched = await refreshTree(repository.id);
  if (!admission.judged) return markSkipped(job.id, admission.reason);

  // Real file and line counts before either the rules or the report read them.
  const push = await enrichPush(repository, received);
  const [knownShas, pull] = await Promise.all([recordedShas(repository.id, push), readPull(repository, push)]);
  // The checks' evidence is what this push changed on its own branch. The
  // snapshot is the project's state — measured and noted, charged to nobody.
  const checks = await readChanges(repository, push, knownShas);
  await refreshMeasurements(repository, touched);
  // After the measurement, which is what fills in the notes it reads.
  await refreshTodos(repository.id, touched);

  const webhookUrl = repository.discordWebhookUrl || env.DISCORD_WEBHOOK_URL || "";
  const judgement = judgePush(
    {
      push,
      knownShas,
      pull,
      rules: repository.rules,
      timezoneOffset: settings.timezoneOffset,
      watchers: repository.watchers,
      checks,
      silentWhenClean: repository.silentWhenClean,
      hasChannel: webhookUrl !== "",
    },
    logRuleError,
  );
  if (judgement.withheld !== null) return markSkipped(job.id, judgement.withheld);

  await record(job, { push, knownShas, repository, settings, judgement, webhookUrl });
}

/**
 * Everything the push leaves behind, then the communiqué itself.
 *
 * Counters advance before generation so the report can cite a total that
 * includes the push being reported on.
 */
async function record(
  job: PrismaDelivery,
  ctx: {
    push: NormalizedPush;
    knownShas: ReadonlySet<string>;
    repository: Repository;
    settings: Settings;
    judgement: Judgement;
    webhookUrl: string;
  },
): Promise<void> {
  const { push, repository, settings, judgement, webhookUrl } = ctx;
  const { violations, commendations, event } = judgement;

  const history = await recordPush({
    repositoryId: repository.id,
    pusher: judgement.pusher,
    commits: newCommitsBy(push, ctx.knownShas),
    violations,
    addressee: push.actorLogin,
  });

  await writeLedger({ repositoryId: repository.id, push, judgement, deliveryId: job.id });

  const watcher = resolveWatcher(repository.watchers, push.branch);
  await report(job, { push, event, repository, settings, violations, commendations, history, webhookUrl, watcher });
}

/**
 * Generation and delivery. `judgePush` decided *whether* this push is reported;
 * this decides *what the report says* — and it is here that the code review
 * runs, before the model writes a word about work it would otherwise only see
 * the commit titles of.
 */
async function report(
  job: PrismaDelivery,
  ctx: {
    push: NormalizedPush;
    event: Judgement["event"];
    repository: Repository;
    settings: Settings;
    violations: ViolationHit[];
    commendations: Commendation[];
    history: Awaited<ReturnType<typeof recordPush>>;
    webhookUrl: string;
    watcher: Watcher;
  },
): Promise<void> {
  const [prompt, reviews] = await Promise.all([
    // The branch's own persona when it names one, otherwise the repository's.
    resolvePrompt(ctx.watcher.promptId ?? ctx.repository.promptId),
    reviewPushCommits(
      ctx.repository.id,
      ctx.push.commits.map((commit) => commit.sha),
    ).catch(() => []),
  ]);

  const composed = await composeReport({ ...ctx, prompt, reviews });
  await deliver({
    job,
    webhookUrl: ctx.webhookUrl,
    composed,
    violationCount: ctx.violations.length,
  });
}

