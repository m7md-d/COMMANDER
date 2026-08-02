/**
 * The outbox worker: poll, claim, process, repeat.
 *
 * It runs in the API process. That is deliberate for a system whose volume is a
 * few messages a day — a separate worker container would double the operational
 * surface for no benefit. `claimBatch` uses SKIP LOCKED, so scaling to multiple
 * API replicas later needs no change here.
 */

import { env } from "@/config/env.js";
import { createLogger, describeError } from "@/core/logger/logger.js";
import { getSettings } from "@/modules/settings/settings.service.js";
import { refreshDossiers } from "@/modules/dossier/dossier.maintenance.js";
import { processDelivery } from "./delivery.processor.js";
import { claimBatch, prune, recoverOrphans } from "./outbox.service.js";
import { reconcile } from "./reconciler.js";
import { scheduleDigests } from "./digest.scheduler.js";

const log = createLogger("worker");
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1_000;
/**
 * Poll GitHub for pushes missed while the process was offline. Runs on startup
 * (the catch-up after a laptop wakes) and periodically. A no-op without the
 * GitHub App — see reconciler.ts.
 */
const RECONCILE_INTERVAL_MS = 30 * 60 * 1_000;
/**
 * Decay changes a score with no new events at all, so a dossier left untouched
 * still has to age. Without this tick a quiet member stays frozen at whatever
 * tier their last push produced — exactly the data rot this is meant to avoid.
 */
const DOSSIER_INTERVAL_MS = 60 * 60 * 1_000;

let timer: NodeJS.Timeout | null = null;
let pruneTimer: NodeJS.Timeout | null = null;
let dossierTimer: NodeJS.Timeout | null = null;
let reconcileTimer: NodeJS.Timeout | null = null;
let running = false;
let stopping = false;

async function tick(): Promise<void> {
  // Overlapping ticks would claim the same batch twice on a slow LLM call.
  if (running || stopping) return;
  running = true;

  try {
    const jobs = await claimBatch(env.QUEUE_BATCH_SIZE);
    if (jobs.length === 0) return;

    log.info("processing batch", { count: jobs.length });
    // Sequential on purpose: parallel calls to a free-tier model just trade a
    // queue on our side for a 429 on theirs.
    for (const job of jobs) {
      if (stopping) break;
      await processDelivery(job);
    }
  } catch (error) {
    log.error("tick failed", describeError(error));
  } finally {
    running = false;
  }
}

async function pruneOldDeliveries(): Promise<void> {
  try {
    const { deliveryRetentionDays } = await getSettings();
    const deleted = await prune(deliveryRetentionDays);
    if (deleted > 0) log.info("pruned deliveries", { deleted });
  } catch (error) {
    log.error("prune failed", describeError(error));
  }
}

async function runReconcile(): Promise<void> {
  try {
    await reconcile();
  } catch (error) {
    log.error("reconcile failed", describeError(error));
  }

  // On the same tick rather than a timer of its own: whether a week has ended is
  // read from stored state, so *when* we ask is irrelevant — only that we ask
  // often enough. A second interval would be a second thing to get wrong.
  try {
    await scheduleDigests();
  } catch (error) {
    log.error("digest scheduling failed", describeError(error));
  }
}

export function startWorker(): void {
  if (timer) return;

  timer = setInterval(() => void tick(), env.QUEUE_POLL_INTERVAL_MS);
  pruneTimer = setInterval(() => void pruneOldDeliveries(), PRUNE_INTERVAL_MS);
  dossierTimer = setInterval(() => void refreshDossiers(), DOSSIER_INTERVAL_MS);
  reconcileTimer = setInterval(() => void runReconcile(), RECONCILE_INTERVAL_MS);

  // Do not hold the process open on their account during shutdown.
  timer.unref();
  pruneTimer.unref();
  dossierTimer.unref();
  reconcileTimer.unref();

  log.info("started", { pollMs: env.QUEUE_POLL_INTERVAL_MS, batch: env.QUEUE_BATCH_SIZE });
  void resumeThenTick();
  // Run maintenance once at boot, not only on the hourly timer, so a freshly
  // (re)started instance enriches, reviews and re-scores within a minute instead
  // of sitting idle until the first interval fires — and so its first App call
  // happens now, making a misconfiguration visible immediately rather than in an
  // hour.
  void refreshDossiers();
}

/**
 * First actions after a (re)start: unstick jobs a crash left in `processing`,
 * then drain the local backlog and, in parallel, ask GitHub for pushes missed
 * while the process was down. Recovery runs before the first claim so a resumed
 * job is picked up immediately; the reconcile runs alongside the tick rather
 * than gating it, since a slow GitHub round-trip must not delay local delivery.
 */
async function resumeThenTick(): Promise<void> {
  try {
    const reclaimed = await recoverOrphans();
    if (reclaimed > 0) log.info("reclaimed orphaned jobs", { reclaimed });
  } catch (error) {
    log.error("orphan recovery failed", describeError(error));
  }
  void tick();
  void runReconcile();
}

export async function stopWorker(): Promise<void> {
  stopping = true;
  if (timer) clearInterval(timer);
  if (pruneTimer) clearInterval(pruneTimer);
  if (dossierTimer) clearInterval(dossierTimer);
  if (reconcileTimer) clearInterval(reconcileTimer);
  timer = null;
  pruneTimer = null;
  dossierTimer = null;
  reconcileTimer = null;

  // Let an in-flight job finish rather than leaving its row in `processing`.
  const deadline = Date.now() + 30_000;
  while (running && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  log.info("stopped");
}
