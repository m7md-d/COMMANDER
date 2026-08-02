/**
 * The stored snapshot, shaped for the panel.
 *
 * Everything the chart needs travels in one response: the browser builds the
 * tree from a flat list (see `buildTree`), so a request per directory would be
 * a round trip per click for data we already hold. What it will not do is send
 * an unbounded list — past the limit the response says it was capped rather
 * than quietly handing over half a project.
 */

import type { TreeFile, TreeOwner, TreeSnapshot } from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { NotFoundError } from "@/core/errors/app-error.js";
import { TREE_RESPONSE_LIMIT } from "@/config/constants.js";

/** The columns the snapshot read selects, named so the mapper can be its own
 *  function rather than an inline block inside the query. */
interface StoredRow {
  path: string;
  blobSha: string;
  baselineLines: number | null;
  blob: {
    bytes: number;
    lines: number | null;
    functionLines: number | null;
    nestingDepth: number | null;
    braceDepth: number | null;
    longestLine: number | null;
  };
}

/** What the attribution ledger knows about one path. */
interface PathRecord {
  owners: TreeOwner[];
  lastTouchedAt: string | null;
}

export async function readSnapshot(repositoryId: string): Promise<TreeSnapshot> {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { treeSha: true, treeSyncedAt: true, treeTruncated: true },
  });
  if (!repository) throw new NotFoundError("repos.notFound");

  const [totalFiles, rows, records] = await Promise.all([
    prisma.treeFile.count({ where: { repositoryId } }),
    prisma.treeFile.findMany({
      where: { repositoryId },
      orderBy: { path: "asc" },
      take: TREE_RESPONSE_LIMIT,
      select: {
        path: true,
        blobSha: true,
        baselineLines: true,
        blob: {
          select: {
            bytes: true,
            lines: true,
            functionLines: true,
            nestingDepth: true,
            braceDepth: true,
            longestLine: true,
          },
        },
      },
    }),
    readAttribution(repositoryId),
  ]);

  const files = rows.map((row) => toFile(row, records.get(row.path)));

  return {
    files,
    treeSha: repository.treeSha,
    syncedAt: repository.treeSyncedAt?.toISOString() ?? null,
    truncated: repository.treeTruncated,
    capped: totalFiles > files.length,
    totalFiles,
  };
}

/** One stored row, joined with what the attribution ledger knows about it. */
function toFile(row: StoredRow, record: PathRecord | undefined): TreeFile {
  return {
    path: row.path,
    blobSha: row.blobSha,
    bytes: row.blob.bytes,
    // Passed through as-is: null is "not measured", and substituting a zero here
    // would turn an honest gap into a confident wrong answer.
    metrics: {
      file_lines: row.blob.lines,
      function_lines: row.blob.functionLines,
      nesting_depth: row.blob.nestingDepth,
      brace_depth: row.blob.braceDepth,
      line_length: row.blob.longestLine,
    },
    baseline: row.baselineLines,
    owners: record?.owners ?? [],
    lastTouchedAt: record?.lastTouchedAt ?? null,
  };
}

/**
 * Who has touched each path, most lines first.
 *
 * One pass for the whole repository rather than a lookup per file: the chart
 * renders every row at once, so per-path queries would be thousands of them for
 * a table we can index in memory in one go.
 */
async function readAttribution(repositoryId: string): Promise<Map<string, PathRecord>> {
  const [attributions, members] = await Promise.all([
    prisma.fileAttribution.findMany({
      where: { repositoryId },
      orderBy: { linesAdded: "desc" },
      select: {
        path: true,
        login: true,
        linesAdded: true,
        commitCount: true,
        lastTouchedAt: true,
      },
    }),
    prisma.member.findMany({ where: { repositoryId }, select: { login: true, displayName: true } }),
  ]);

  const names = new Map(members.map((member) => [member.login, member.displayName]));
  const records = new Map<string, PathRecord>();

  for (const row of attributions) {
    const record = records.get(row.path) ?? { owners: [], lastTouchedAt: null };
    record.owners.push({
      login: row.login,
      // Someone who committed but was never imported into the roster still owns
      // lines. Falling back to the login names them; an empty string erases them.
      displayName: names.get(row.login) || row.login,
      linesAdded: row.linesAdded,
      commitCount: row.commitCount,
    });

    const touched = row.lastTouchedAt.toISOString();
    if (!record.lastTouchedAt || touched > record.lastTouchedAt) {
      record.lastTouchedAt = touched;
    }
    records.set(row.path, record);
  }

  return records;
}
