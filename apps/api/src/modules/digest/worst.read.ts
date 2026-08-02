/**
 * The files furthest over their limits, named.
 *
 * The digest already reports *how many* files are over each limit. A count tells
 * a team the size of the problem and nothing about where it is, and a suggestion
 * built on a count can only ever say "consider splitting some files". Naming the
 * three worst, with the measured number and the limit beside them, is the
 * difference between advice and a work item.
 *
 * Read from the stored snapshot, never from GitHub: two readings of one
 * repository that can disagree are worse than one reading.
 */

import { CHECK_METRICS, inScope, type CheckConfig, type CheckMetric } from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { resolveFrontChecks } from "@/modules/checks/checks.read.js";

export interface WorstFile {
  path: string;
  metric: CheckMetric;
  value: number;
  threshold: number;
  /** Where it stood when checks began, when that is known. A file at 400 that
   *  started at 380 reads differently from one that started at 120, and the
   *  report must be able to tell the two apart. */
  baseline: number | null;
}

/** Three per metric. Past that the section is a list, and a list is skipped. */
const PER_METRIC = 3;

type Row = {
  path: string;
  baselineLines: number | null;
  blob: {
    lines: number | null;
    functionLines: number | null;
    nestingDepth: number | null;
    braceDepth: number | null;
    longestLine: number | null;
  };
};

const COLUMN: Record<CheckMetric, (blob: Row["blob"]) => number | null> = {
  file_lines: (blob) => blob.lines,
  function_lines: (blob) => blob.functionLines,
  nesting_depth: (blob) => blob.nestingDepth,
  brace_depth: (blob) => blob.braceDepth,
  line_length: (blob) => blob.longestLine,
};

export async function readWorstFiles(repositoryId: string): Promise<WorstFile[]> {
  const checks = await resolveFrontChecks(repositoryId);
  const rows = await prisma.treeFile.findMany({
    where: { repositoryId },
    select: {
      path: true,
      baselineLines: true,
      blob: {
        select: {
          lines: true,
          functionLines: true,
          nestingDepth: true,
          braceDepth: true,
          longestLine: true,
        },
      },
    },
  });

  return CHECK_METRICS.filter((metric) => checks[metric].enabled).flatMap((metric) =>
    worstFor(rows, metric, checks[metric]),
  );
}

function worstFor(rows: Row[], metric: CheckMetric, config: CheckConfig): WorstFile[] {
  return rows
    .flatMap((row) => {
      const value = COLUMN[metric](row.blob);
      // Unmeasured is not "fine" — it is simply not evidence, and a file that
      // could not be read must never appear in a list of the worst offenders.
      if (value === null || value <= config.threshold) return [];
      if (!inScope(config, row.path)) return [];

      return [{ path: row.path, metric, value, threshold: config.threshold, baseline: row.baselineLines }];
    })
    .sort((a, b) => b.value - a.value || (a.path < b.path ? -1 : 1))
    .slice(0, PER_METRIC);
}
