/**
 * How the code stands, and which way it moved.
 *
 * Its own file because it answers a different question from everything else in
 * the digest: the rest counts what people did in a window, this measures what
 * the code *is* right now. Only one of the two can be recounted from the ledger,
 * which is why the comparison against last week has to be stored rather than
 * derived.
 */

import {
  CHECK_METRICS,
  inScope,
  type CheckConfig,
  type CheckMetric,
  type CodeState,
} from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { resolveFrontChecks } from "@/modules/checks/checks.read.js";

/**
 * How the code stands, and which way it moved.
 *
 * `change` is null on the first digest because "no change" and "nothing to
 * compare against" are different facts, and a zero would claim the first one.
 */
export async function readCodeState(
  repositoryId: string,
  previous: Record<string, number>,
): Promise<CodeState[]> {
  const checks = await resolveFrontChecks(repositoryId);
  const rows = await prisma.treeFile.findMany({
    where: { repositoryId },
    select: {
      path: true,
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

  return CHECK_METRICS.filter((metric) => checks[metric].enabled).map((metric) => {
    const over = countOver(rows, metric, checks[metric]);
    const before = previous[metric];
    return { metric, over, change: before === undefined ? null : over - before };
  });
}

type MetricRow = {
  path: string;
  blob: {
    lines: number | null;
    functionLines: number | null;
    nestingDepth: number | null;
    braceDepth: number | null;
    longestLine: number | null;
  };
};

const COLUMN: Record<CheckMetric, (blob: MetricRow["blob"]) => number | null> = {
  file_lines: (blob) => blob.lines,
  function_lines: (blob) => blob.functionLines,
  nesting_depth: (blob) => blob.nestingDepth,
  brace_depth: (blob) => blob.braceDepth,
  line_length: (blob) => blob.longestLine,
};

function countOver(
  rows: MetricRow[],
  metric: CheckMetric,
  config: CheckConfig,
): number {
  return rows.filter((row) => {
    const value = COLUMN[metric](row.blob);
    return value !== null && value > config.threshold && inScope(config, row.path);
  }).length;
}

