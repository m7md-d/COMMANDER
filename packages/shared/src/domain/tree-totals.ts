/**
 * The arithmetic a collapsed directory reports.
 *
 * Split from the tree building because they answer different questions: `tree.ts`
 * decides what is nested under what, this decides what a node *claims* about its
 * subtree. And the claims are the part that has to be exactly right — "3 over the
 * limit" on a folder nobody has opened is the sentence an operator acts on.
 */

import { CHECK_METRICS, type CheckConfigMap } from "./checks.js";
import { inScope } from "./check-scope.js";
import type { TreeFile } from "../contracts/tree.js";

export interface TreeTotals {
  files: number;
  bytes: number;
  /** Summed over measured descendants only. */
  lines: number;
  /** How many of `files` carried a measurement. Zero means `lines` is an empty
   *  sum and the reader must be told "unmeasured" — never "0 lines". A count
   *  below `files` means the sum is a floor, which the chart has to admit. */
  measured: number;
  /** Measured descendants standing over a limit — any limit.
   *
   *  Counted in the rollup so a *collapsed* directory can say how much of the
   *  problem is inside it — the whole reason this is a chart and not a file
   *  explorer. It reports state, not blame: who is answerable for a file being
   *  over is a separate question, decided by `judgeCheck` on the crossing. */
  over: number;
  /** Whoever added the most lines beneath this node. Null when nothing here has
   *  been attributed to anyone yet. */
  topOwner: string | null;
  lastTouchedAt: string | null;
}

export interface TreeNode {
  /** The segment alone — the chart indents, it does not repeat the path. */
  name: string;
  /** The full path, which is what a file's record is keyed on. */
  path: string;
  kind: "dir" | "file";
  /** Empty on a file. */
  children: TreeNode[];
  totals: TreeTotals;
  /** The row this node was built from. Null on a directory, which has no row. */
  file: TreeFile | null;
}

export function emptyTotals(): TreeTotals {
  return { files: 0, bytes: 0, lines: 0, measured: 0, over: 0, topOwner: null, lastTouchedAt: null };
}

/**
 * Is this file over any limit that applies to it?
 *
 * Any, not all: one metric crossed is a file worth looking at, and a directory
 * that reported "clear" because two of three metrics were fine would be
 * reassuring about the wrong thing. Null is never over — an unmeasured file is
 * unknown, and counting it either way is an answer we do not have.
 */
export function isOver(file: TreeFile, checks: CheckConfigMap): boolean {
  return CHECK_METRICS.some((metric) => {
    const config = checks[metric];
    const value = file.metrics[metric];
    return config.enabled && value !== null && inScope(config, file.path) && value > config.threshold;
  });
}

export function fileTotals(file: TreeFile, checks: CheckConfigMap): TreeTotals {
  const lines = file.metrics.file_lines;

  return {
    files: 1,
    bytes: file.bytes,
    lines: lines ?? 0,
    measured: lines === null ? 0 : 1,
    over: isOver(file, checks) ? 1 : 0,
    topOwner: file.owners[0]?.login ?? null,
    lastTouchedAt: file.lastTouchedAt,
  };
}

export function absorb(into: TreeTotals, add: TreeTotals): void {
  into.files += add.files;
  into.bytes += add.bytes;
  into.lines += add.lines;
  into.measured += add.measured;
  into.over += add.over;
  // ISO-8601 strings compare correctly as strings, so the latest touch needs no
  // Date allocation per file — which matters at a few thousand rows.
  if (add.lastTouchedAt && (!into.lastTouchedAt || add.lastTouchedAt > into.lastTouchedAt)) {
    into.lastTouchedAt = add.lastTouchedAt;
  }
}

/** Whoever owns the most lines, ties broken by login so the chart does not
 *  reshuffle between two renders of identical data. */
export function leader(owners: Map<string, number>): string | null {
  const ranked = [...owners].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return ranked[0]?.[0] ?? null;
}

export function credit(owners: Map<string, number>, file: TreeFile): void {
  for (const owner of file.owners) {
    owners.set(owner.login, (owners.get(owner.login) ?? 0) + owner.linesAdded);
  }
}
