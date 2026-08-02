/**
 * Judging what a push did to the files it touched.
 *
 * The measurement is content-addressed and the judgement is pure; this file only
 * joins them — it reads the two readings a path had, asks the domain what that
 * means, and hands back entries in exactly the shape the rule engine produces.
 * Downstream, a crossing is a violation like any other: same ledger, same repeat
 * bands, same dossier.
 *
 * Both directions leave here. `judgeCheck` has always returned `improved` for a
 * limit crossed back the right way, and for a while this file dropped it on the
 * floor — which made the subsystem a one-way ratchet that could only ever find
 * fault, while the panel's own manual told operators that improvement is praised.
 *
 * Fail-safe throughout. A file whose *before* was never measured cannot be shown
 * to have crossed anything, so it is not charged to anyone — the baseline is
 * recorded and the matter is closed. Charging on a guess is the one outcome this
 * subsystem must never produce.
 */

import type { TouchedFile } from "@/domain/tree/diff.js";
import { prisma } from "@/db/prisma.js";
import { createLogger } from "@/core/logger/logger.js";
import { MEASURE_BATCH_PUSH } from "@/config/constants.js";
import { measureBlobs, wanted, type MeasureTarget } from "./checks.measure.js";
import { judgeFile, type CheckOutcome, type Reading } from "./checks.judge.js";

export type { CheckOutcome } from "./checks.judge.js";

const log = createLogger("checks");

export async function evaluateChecks(
  target: MeasureTarget,
  touched: TouchedFile[],
): Promise<CheckOutcome> {
  const relevant = touched.filter((file) => wanted(target.checks, file.path));
  if (relevant.length === 0) return { violations: [], commendations: [] };

  const paths = relevant.map((file) => file.path);
  // Measure what this push brought in before reading anything: the "after" value
  // of a file nobody has counted yet does not exist until now.
  await measureBlobs(target, paths, MEASURE_BATCH_PUSH);

  const readings = await readMeasurements(relevant);
  const baselines = await readBaselines(target.repositoryId, paths);

  const outcome: CheckOutcome = { violations: [], commendations: [] };
  for (const file of relevant) {
    const judged = judgeFile(target, file, readings);
    outcome.violations.push(...judged.violations);
    outcome.commendations.push(...judged.commendations);
    await anchorBaseline({ repositoryId: target.repositoryId, file, readings, baselines });
  }

  if (outcome.violations.length > 0 || outcome.commendations.length > 0) {
    log.info("checks judged", {
      repositoryId: target.repositoryId,
      crossed: outcome.violations.length,
      improved: outcome.commendations.length,
    });
  }
  return outcome;
}

/** Every blob involved, old and new, in one read. */
async function readMeasurements(touched: TouchedFile[]): Promise<Map<string, Reading>> {
  const shas = new Set<string>();
  for (const file of touched) {
    shas.add(file.sha);
    if (file.previousSha) shas.add(file.previousSha);
  }

  const rows = await prisma.blobMetric.findMany({
    where: { sha: { in: [...shas] } },
    select: {
      sha: true,
      lines: true,
      functionLines: true,
      nestingDepth: true,
      braceDepth: true,
      longestLine: true,
    },
  });

  return new Map(rows.map((row) => [row.sha, row]));
}

async function readBaselines(
  repositoryId: string,
  paths: string[],
): Promise<Map<string, number | null>> {
  const rows = await prisma.treeFile.findMany({
    where: { repositoryId, path: { in: paths } },
    select: { path: true, baselineLines: true },
  });
  return new Map(rows.map((row) => [row.path, row.baselineLines]));
}

/**
 * Records what a path already was the first time we could measure it, and never
 * again. A baseline that moves is not a baseline — it would quietly re-date
 * inherited code as everybody's fault on every push.
 */
async function anchorBaseline(input: {
  repositoryId: string;
  file: TouchedFile;
  readings: Map<string, Reading>;
  baselines: Map<string, number | null>;
}): Promise<void> {
  const { repositoryId, file, readings, baselines } = input;
  const current = baselines.get(file.path);
  if (current !== null && current !== undefined) return;

  const before = file.previousSha === null ? null : (readings.get(file.previousSha)?.lines ?? null);
  const value = before ?? readings.get(file.sha)?.lines ?? null;
  if (value === null) return;

  await prisma.treeFile.update({
    where: { repositoryId_path: { repositoryId, path: file.path } },
    data: { baselineLines: value },
  });
}
