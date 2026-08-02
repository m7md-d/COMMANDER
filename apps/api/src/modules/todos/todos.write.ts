/**
 * Keeping the note index in step with the tree.
 *
 * Only the paths a push touched are reconciled, not the whole project. That is
 * the same rule the tree itself follows — cost linear in *change*, not in size —
 * and it is what makes the index affordable on every delivery rather than being
 * something a nightly job has to catch up on.
 *
 * `firstSeenAt` survives an update, exactly as it does on a tree row, and for
 * the same reason: it is the anchor the age is read from, and an age that resets
 * whenever the file around it is edited would report every note as new. That is
 * the one number this table exists to produce.
 */

import { markerFingerprint, type Marker } from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { createLogger } from "@/core/logger/logger.js";

const log = createLogger("todos");

/** Per delivery. A push that rewrote a thousand files is a push whose note index
 *  can wait for the next one rather than stalling the communiqué. */
const TOUCHED_LIMIT = 200;

export async function syncTodos(repositoryId: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const scope = paths.slice(0, TOUCHED_LIMIT);

  const rows = await prisma.treeFile.findMany({
    where: { repositoryId, path: { in: scope } },
    select: { path: true, blob: { select: { markers: true } } },
  });

  const seen = new Map<string, Marker & { path: string }>();
  for (const row of rows) {
    for (const marker of readStored(row.blob.markers)) {
      seen.set(markerFingerprint(row.path, marker.text), { ...marker, path: row.path });
    }
  }

  const now = new Date();
  for (const [fingerprint, marker] of seen) {
    await prisma.todoMarker.upsert({
      where: { repositoryId_fingerprint: { repositoryId, fingerprint } },
      create: {
        repositoryId,
        fingerprint,
        path: marker.path,
        kind: marker.kind,
        line: marker.line,
        text: marker.text,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      // The line moves, the note does not. `firstSeenAt` is deliberately absent.
      update: { line: marker.line, kind: marker.kind, lastSeenAt: now },
    });
  }

  // Gone from a path this push touched means resolved — the note was deleted or
  // rewritten, and either way the old one is not there any more. Restricted to
  // the touched paths so a partial sync never mistakes "not looked at" for
  // "removed", which would silently reset the ages of everything else.
  const removed = await prisma.todoMarker.deleteMany({
    where: { repositoryId, path: { in: scope }, fingerprint: { notIn: [...seen.keys()] } },
  });

  if (seen.size > 0 || removed.count > 0) {
    log.info("notes indexed", { repositoryId, seen: seen.size, resolved: removed.count });
  }
}

/**
 * The stored JSON as markers, or nothing.
 *
 * Null means the blob predates marker scanning and has not been swept yet, which
 * is not the same as "this file has no notes" — so it yields nothing to index
 * rather than an emptiness that would delete real rows.
 */
function readStored(value: unknown): Marker[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const marker = entry as Record<string, unknown>;
    if (typeof marker["text"] !== "string" || typeof marker["line"] !== "number") return [];
    if (typeof marker["kind"] !== "string") return [];

    return [{ kind: marker["kind"], line: marker["line"], text: marker["text"] } as Marker];
  });
}
