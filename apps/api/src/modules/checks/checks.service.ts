/**
 * The measurements behind the checks, kept up to date. Two jobs, and neither
 * decides anything.
 *
 * For the stored snapshot — the project's state, which the panel and the digest
 * read — it measures what the snapshot moved and anchors each path's baseline.
 * For a push, it measures both sides of what the push changed and hands the
 * readings back for `judgePush` to judge. The judgement itself is pure
 * (`domain/checks/judge.ts`) and never reads the snapshot: the snapshot follows
 * one branch, and judging its movements charged pushes with other branches'
 * work.
 *
 * Fail-safe throughout. A file whose *before* was never measured cannot be shown
 * to have crossed anything, so it is not charged to anyone. Charging on a guess
 * is the one outcome this subsystem must never produce.
 */

import type { TouchedFile } from "@/domain/tree/diff.js";
import { wanted, type Reading } from "@/domain/checks/judge.js";
import { prisma } from "@/db/prisma.js";
import { MEASURE_BATCH_PUSH } from "@/config/constants.js";
import { measureBlobs, measureListed, type MeasureTarget } from "./checks.measure.js";

/** What the snapshot moved: measured, and each path's baseline anchored the first time it can be. */
export async function measureSnapshot(target: MeasureTarget, touched: TouchedFile[]): Promise<void> {
  const relevant = touched.filter((file) => wanted(target.checks, file.path));
  if (relevant.length === 0) return;

  const paths = relevant.map((file) => file.path);
  // Measure what the snapshot brought in before reading anything: the value of
  // a file nobody has counted yet does not exist until now.
  await measureBlobs(target, paths, MEASURE_BATCH_PUSH);

  const readings = await readMeasurements(relevant);
  const baselines = await readBaselines(target.repositoryId, paths);
  for (const file of relevant) {
    await anchorBaseline({ repositoryId: target.repositoryId, file, readings, baselines });
  }
}

/**
 * Both sides of what a push changed, measured by content — a blob on a work
 * branch is as measurable as one on main — and read back by hash.
 */
export async function measureChanges(
  target: MeasureTarget,
  input: { changes: TouchedFile[]; bytes: ReadonlyMap<string, number> },
): Promise<Map<string, Reading>> {
  const blobs = input.changes.flatMap((file) =>
    sides(file).map((sha) => ({ path: file.path, sha, bytes: input.bytes.get(sha) ?? 0 })),
  );
  await measureListed(target, blobs, MEASURE_BATCH_PUSH);
  return readMeasurements(input.changes);
}

const sides = (file: TouchedFile): string[] => (file.previousSha ? [file.sha, file.previousSha] : [file.sha]);

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
