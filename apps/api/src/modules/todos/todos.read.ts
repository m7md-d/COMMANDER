/**
 * The note index as evidence for a report.
 *
 * Two readings, because a hundred notes is not a finding and three specific ones
 * are: a tally that says how big the pile is, and the oldest few named with their
 * ages. The age is the whole point — every project has TODOs, and the only ones
 * worth a line in a weekly report are the ones that have stopped being plans.
 */

import { MARKER_KINDS, type MarkerKind } from "@commander/shared";
import { prisma } from "@/db/prisma.js";

export interface AgedNote {
  path: string;
  line: number;
  kind: MarkerKind;
  text: string;
  /** Days since we first saw it — "since watching began", never "since written".
   *  The report says which, because only one of them is true. */
  ageDays: number;
}

export interface NoteIndex {
  total: number;
  byKind: { kind: MarkerKind; count: number }[];
  /** Oldest first. The report names a handful; the rest are a number. */
  oldest: AgedNote[];
  /** Written in the window being reported on — the pile is growing or it is not. */
  added: number;
}

/** Beyond a handful the list stops being read and starts being scrolled past. */
const NAMED = 5;

const DAY_MS = 86_400_000;

export async function readNotes(repositoryId: string, since: Date, now: Date): Promise<NoteIndex> {
  const [rows, counts, added] = await Promise.all([
    prisma.todoMarker.findMany({
      where: { repositoryId },
      orderBy: { firstSeenAt: "asc" },
      take: NAMED,
      select: { path: true, line: true, kind: true, text: true, firstSeenAt: true },
    }),
    prisma.todoMarker.groupBy({
      by: ["kind"],
      where: { repositoryId },
      _count: { _all: true },
    }),
    prisma.todoMarker.count({ where: { repositoryId, firstSeenAt: { gte: since } } }),
  ]);

  return {
    total: counts.reduce((sum, entry) => sum + entry._count._all, 0),
    byKind: MARKER_KINDS.map((kind) => ({
      kind,
      count: counts.find((entry) => entry.kind === kind)?._count._all ?? 0,
    })).filter((entry) => entry.count > 0),
    oldest: rows.map((row) => ({
      path: row.path,
      line: row.line,
      kind: row.kind as MarkerKind,
      text: row.text,
      ageDays: Math.floor((now.getTime() - row.firstSeenAt.getTime()) / DAY_MS),
    })),
    added,
  };
}
