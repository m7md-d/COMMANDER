/**
 * The measurement backlog, filled in a batch at a time.
 *
 * Separate from the reconciler proper because the two recover different things
 * and fail differently. The reconciler recovers *pushes* — a gap there is a
 * report nobody ever got. This recovers *measurements* — a gap here is a file
 * whose size we cannot yet judge a crossing against, which is a stated absence
 * rather than a loss, and must never abort the more important job.
 *
 * Pushes only ever reach the files they touch, so a crossing cannot be told
 * from an inheritance without knowing what the *untouched* files already were.
 * That is what this fills in.
 */

import { MEASURE_BATCH_SWEEP } from "@/config/constants.js";
import { createLogger } from "@/core/logger/logger.js";
import { measureBlobs, scopedPaths } from "@/modules/checks/checks.measure.js";
import { resolveFrontChecks } from "@/modules/checks/checks.read.js";
import { syncTodos } from "@/modules/todos/todos.write.js";

const log = createLogger("reconciler-sweep");

export interface SweepTarget {
  id: string;
  fullName: string;
  githubInstallationId: string;
}

/** Best-effort: an unmeasured file is a stated gap, and one that must never
 *  stop the far more important job of recovering missed pushes. */
export async function sweepMeasurements(repo: SweepTarget): Promise<void> {
  try {
    const checks = await resolveFrontChecks(repo.id);
    const paths = await scopedPaths(repo.id, checks);
    if (paths.length === 0) return;

    const measured = await measureBlobs(
      {
        repositoryId: repo.id,
        fullName: repo.fullName,
        installationId: repo.githubInstallationId,
        checks,
      },
      paths,
      MEASURE_BATCH_SWEEP,
    );

    // Only the paths this batch actually read. Handing the sweep's whole path
    // list to the index would let files whose bytes have never been scanned
    // report "no notes" and delete real rows.
    await syncTodos(repo.id, measured);
  } catch (error) {
    log.warn("measurement sweep failed", { repo: repo.fullName, error: String(error) });
  }
}
