/**
 * The tree and its measurements, brought up to date for one delivery.
 *
 * Split out of the processor because it is the one step there that is allowed to
 * fail without consequence. Everything else in that file decides whether a
 * report happens; this decides only how much the report will know — and a
 * refusal from GitHub must cost knowledge, never the communiqué.
 *
 * Deliberately not in `report.pipeline.ts`, which the panel's preview shares: a
 * preview is a rehearsal, and a rehearsal that rewrote the stored snapshot would
 * be indistinguishable from a real push in the record.
 */

import type { Repository } from "@commander/shared";
import { createLogger } from "@/core/logger/logger.js";
import { syncTree } from "@/modules/tree/tree.service.js";
import { evaluateChecks, type CheckOutcome } from "@/modules/checks/checks.service.js";
import { resolveFrontChecks } from "@/modules/checks/checks.read.js";
import { syncTodos } from "@/modules/todos/todos.write.js";
import type { TouchedFile } from "@/domain/tree/diff.js";

const log = createLogger("processor");

/**
 * Refreshes the snapshot and returns what this push moved.
 *
 * An empty list is the honest answer to every failure here: nothing moved that
 * we can prove, so nothing is judged. Logged rather than rethrown, like the
 * ledger write — the snapshot can be rebuilt by the next push or the reconciler,
 * the communiqué cannot.
 */
export async function refreshTree(repositoryId: string): Promise<TouchedFile[]> {
  const result = await syncTree(repositoryId).catch((error: unknown) => {
    log.error("tree sync crashed", { repositoryId, error: String(error) });
    return null;
  });

  if (result?.status === "failed") {
    log.warn("tree sync failed", { repositoryId, error: result.error });
  }

  return result?.status === "synced" ? result.touched : [];
}

/**
 * Measures what this push touched and reports the limits it crossed — in either
 * direction.
 *
 * The violations come back rule-shaped so the rest of the pipeline needs to know
 * nothing about checks: the tone, the embed and the repeat bands read one list,
 * exactly as they did before checks existed. The commendations travel beside
 * them rather than inside them, because every one of those readers treats its
 * list as a count of what is wrong.
 */
export async function runChecks(
  repository: Repository,
  touched: TouchedFile[],
): Promise<CheckOutcome> {
  const nothing: CheckOutcome = { violations: [], commendations: [] };
  if (touched.length === 0 || !repository.githubInstallationId) return nothing;

  // Resolved per delivery, not cached: a template edited a minute ago must judge
  // this push, and a front that switched templates must not be judged by the old
  // one because a process has been up since before the change.
  const checks = await resolveFrontChecks(repository.id);

  return evaluateChecks(
    {
      repositoryId: repository.id,
      fullName: repository.fullName,
      installationId: repository.githubInstallationId,
      checks,
    },
    touched,
  ).catch((error: unknown) => {
    log.error("checks crashed", { repositoryId: repository.id, error: String(error) });
    return nothing;
  });
}

/**
 * Brings the note index in step with what this push touched.
 *
 * Its own step rather than part of `runChecks`, because it is not a judgement:
 * nothing here is charged to anybody, and a failure costs a report some context
 * rather than costing somebody a finding. Logged and swallowed for that reason.
 */
export async function refreshTodos(repositoryId: string, touched: TouchedFile[]): Promise<void> {
  if (touched.length === 0) return;

  await syncTodos(
    repositoryId,
    touched.map((file) => file.path),
  ).catch((error: unknown) => {
    log.warn("note index failed", { repositoryId, error: String(error) });
  });
}
