/**
 * Turning stored blobs into measurements.
 *
 * Every blob is fetched at most once, ever, by any repository — the row is keyed
 * on the content hash, so a rename, a revert, or the same vendored file in a
 * second project all land on a measurement already on record. That is what keeps
 * the cost linear in *change* instead of in project size.
 *
 * Bounded on purpose. A first sweep of a large project does not run to
 * completion; it takes a batch and leaves the rest for the next pass. A file
 * left unmeasured is a stated gap, which is a far better failure than a
 * rate-limit ban halfway through building a record nobody can tell is partial.
 */

import { CHECK_METRICS, readMarkers, type CheckConfigMap } from "@commander/shared";
import { readingOf, wanted } from "@/domain/checks/judge.js";
import { prisma } from "@/db/prisma.js";
import { toJson } from "@/core/json.js";
import { createLogger } from "@/core/logger/logger.js";
import { MEASURE_MAX_BYTES } from "@/config/constants.js";
import { fetchBlob } from "@/integrations/github/github.client.js";
import { recordBlobs } from "@/modules/tree/tree.write.js";

const log = createLogger("checks");

export interface MeasureTarget {
  installationId: string;
  fullName: string;
  repositoryId: string;
  /** The limits this front is judged by, already resolved through its template
   *  and overrides — passed in so no layer of config is re-read per file. */
  checks: CheckConfigMap;
}

/** A path whose blob is in scope and has no measurement yet. */
interface Pending {
  path: string;
  sha: string;
}

/**
 * Measures up to `limit` unmeasured blobs, newest paths first among the ones
 * given. Returns the paths it actually read — the note index needs to know which
 * files it may now treat as authoritative, and a count cannot tell it.
 *
 * Never throws: a measurement that could not be taken leaves `lines` null, and
 * null means *not measured* everywhere downstream. Writing a zero here would
 * turn a network failure into a confident claim that a file is empty.
 */
export async function measureBlobs(
  target: MeasureTarget,
  paths: string[],
  limit: number,
): Promise<string[]> {
  if (nothingEnabled(target)) return [];
  return measurePending(target, await pendingBlobs(target, paths, limit));
}

/**
 * Measures blobs named by their content rather than by the stored snapshot:
 * both sides of what a push changed, on whatever branch it was pushed. Their
 * rows are created first — a blob on a work branch was never in the snapshot —
 * and only those still unmeasured are read, up to `limit`.
 */
export async function measureListed(
  target: MeasureTarget,
  blobs: { path: string; sha: string; bytes: number }[],
  limit: number,
): Promise<void> {
  const eligible = blobs.filter((blob) => wanted(target.checks, blob.path));
  if (nothingEnabled(target) || eligible.length === 0) return;

  const bytes = new Map(eligible.map((blob) => [blob.sha, blob.bytes]));
  await recordBlobs([...bytes].map(([sha, size]) => ({ sha, bytes: size })));

  const rows = await prisma.blobMetric.findMany({
    where: { sha: { in: [...bytes.keys()] }, bytes: { lte: MEASURE_MAX_BYTES }, OR: [{ lines: null }, { markersAt: null }] },
    select: { sha: true },
    take: limit,
  });
  const path = new Map(eligible.map((blob) => [blob.sha, blob.path]));
  await measurePending(target, rows.map((row) => ({ sha: row.sha, path: path.get(row.sha) ?? "" })));
}

/** The cheapest request is the one nobody makes: with every metric off, no blob's bytes are wanted. */
const nothingEnabled = (target: MeasureTarget): boolean =>
  CHECK_METRICS.every((metric) => !target.checks[metric].enabled);

async function measurePending(target: MeasureTarget, pending: Pending[]): Promise<string[]> {
  const measured: string[] = [];
  for (const blob of pending) {
    const content = await fetchBlob(target.installationId, target.fullName, blob.sha);
    if (!content.ok) {
      log.warn("blob measure failed", { path: blob.path, error: content.error });
      continue;
    }

    // One pass, every metric. Fetching the bytes is the expensive part, so the
    // fifth measurement costs no more than the first once the request is paid
    // for — including the parse, which is microseconds beside a round trip.
    const now = new Date();

    await prisma.blobMetric.update({
      where: { sha: blob.sha },
      data: {
        ...readingOf(blob.path, content.data),
        measuredAt: now,
        // Stamped separately from `measuredAt` so a blob measured before markers
        // existed is visibly *unscanned* rather than silently note-free — the
        // sweep below picks those up and backfills them.
        markers: toJson(readMarkers(content.data)),
        markersAt: now,
      },
    });
    measured.push(blob.path);
  }

  if (measured.length > 0) {
    log.info("blobs measured", { repositoryId: target.repositoryId, measured: measured.length });
  }
  return measured;
}

/**
 * In-scope paths whose current blob has never been counted.
 *
 * Scope is applied to the *path* and the size cap to the blob, so a file is
 * skipped for a stated reason rather than silently: out of scope means "not
 * ours to judge", too large means "not countable", and both stay null.
 */
async function pendingBlobs(
  target: MeasureTarget,
  paths: string[],
  limit: number,
): Promise<Pending[]> {
  // In scope for *any* enabled metric: the fetch is shared, so a file wanted by
  // one metric is measured for all of them at no extra cost.
  const eligible = paths.filter((path) => wanted(target.checks, path));
  if (eligible.length === 0) return [];

  const rows = await prisma.treeFile.findMany({
    where: {
      repositoryId: target.repositoryId,
      path: { in: eligible },
      blob: {
        bytes: { lte: MEASURE_MAX_BYTES },
        // Either measurement missing is reason enough to read the bytes: the
        // request is the cost, and re-deriving the numbers from content that
        // hashes the same cannot change them.
        OR: [{ lines: null }, { markersAt: null }],
      },
    },
    select: { path: true, blobSha: true },
    take: limit,
  });

  return rows.map((row) => ({ path: row.path, sha: row.blobSha }));
}

/** Every in-scope path of a repository, for the periodic sweep that fills in
 *  what pushes never touched — a baseline needs the whole tree, not the busy
 *  parts of it. */
export async function scopedPaths(
  repositoryId: string,
  checks: CheckConfigMap,
): Promise<string[]> {
  const rows = await prisma.treeFile.findMany({
    where: { repositoryId },
    select: { path: true },
  });

  return rows.map((row) => row.path).filter((path) => wanted(checks, path));
}
