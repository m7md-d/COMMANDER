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
import { branchIsWatched } from "@/modules/repositories/repositories.mapper.js";
import { findByFullName } from "@/modules/repositories/repositories.service.js";
import { getDefaultPrompt, getPrompt } from "@/modules/prompts/prompts.service.js";
import { getSettings } from "@/modules/settings/settings.service.js";
import { recordPush } from "@/modules/stats/stats.service.js";
import { reviewPushCommits } from "@/modules/dossier/review.service.js";
import { composeReport, detectViolations } from "./report.pipeline.js";
import { refreshTodos, refreshTree, runChecks } from "./delivery.checks.js";
import { writeLedger } from "./delivery.ledger.js";
import { deliver } from "./delivery.dispatch.js";
import { processDigest } from "./digest.processor.js";
import { enrichPush } from "./push.enrich.js";
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

async function run(job: PrismaDelivery, received: NormalizedPush): Promise<void> {
  let push = received;
  const settings = await getSettings();

  if (settings.paused) {
    await markSkipped(job.id, "system_paused");
    return;
  }

  const repository = await findByFullName(push.repoFullName);
  if (!repository) return markSkipped(job.id, "repo_not_configured");
  if (!repository.enabled) return markSkipped(job.id, "repo_disabled");
  if (!branchIsWatched(repository.branches, push.branch)) {
    return markSkipped(job.id, "branch_not_watched");
  }
  // Before the gates below, not after: a push we choose not to report still
  // moved the code, and a snapshot that skips those pushes would drift until the
  // next reconcile and blame the wrong person for what it then finds.
  const touched = await refreshTree(repository.id);

  // A branch deletion carries no commits but is still worth reporting.
  if (push.commits.length === 0 && !push.deleted) return markSkipped(job.id, "no_commits");

  // Real file and line counts before either the rules or the report read them.
  push = await enrichPush(repository, push);

  // Rules read the push, checks read the tree — and from here down the charges
  // are one list, so the tone, the embed and the dossier need to know about
  // neither. What was earned travels separately; see runChecks.
  const checked = await runChecks(repository, touched);
  // After the measurement, which is what fills in the notes it reads.
  await refreshTodos(repository.id, touched);
  const violations = [...detectViolations(push, repository, settings), ...checked.violations];

  // A push that only fixed things is not a clean push in the sense this flag
  // means. The setting exists to stop routine work filling a channel, and
  // someone taking a file back under its limit is the one thing here worth
  // interrupting for.
  if (repository.silentWhenClean && violations.length === 0 && checked.commendations.length === 0) {
    return markSkipped(job.id, "clean_and_silent");
  }

  const webhookUrl = repository.discordWebhookUrl || env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return markSkipped(job.id, "discord_missing");

  await record(job, {
    push,
    repository,
    settings,
    violations,
    commendations: checked.commendations,
    webhookUrl,
  });
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
    repository: Repository;
    settings: Settings;
    violations: ViolationHit[];
    commendations: Commendation[];
    webhookUrl: string;
  },
): Promise<void> {
  const { push, repository, violations } = ctx;

  const history = await recordPush({
    repositoryId: repository.id,
    login: push.actorLogin,
    commitCount: push.commits.length,
    violations,
  });

  await writeLedger({
    repositoryId: repository.id,
    push,
    violations,
    commendations: ctx.commendations,
    deliveryId: job.id,
  });

  const watcher = resolveWatcher(repository.watchers, push.branch);
  await report(job, { ...ctx, history, watcher });
}

/**
 * Generation and delivery. Split from the gates above so each half stays legible:
 * `run` decides *whether* this push is reportable, this decides *what the report
 * says* — and it is here that the code review runs, before the model writes a
 * word about work it would otherwise only see the commit titles of.
 */
async function report(
  job: PrismaDelivery,
  ctx: {
    push: NormalizedPush;
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

