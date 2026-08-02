/**
 * A repository's layout, compressed to something a prompt can carry.
 *
 * The raw tree of a real project is thousands of paths — useless in a context
 * window and useless to a reader. What actually answers "does this file belong
 * here?" is the shape: which top-level areas exist, how big each is, and what
 * kind of code lives in them. That is what this extracts.
 *
 * Pure and deterministic: the same tree always yields the same digest, so the
 * digest can be cached against the tree sha and only recomputed when it moves.
 */

import { z } from "zod";

/**
 * The digest is cached as JSON, so — like every other JSON the platform stores —
 * its shape is asserted on read rather than trusted.
 */
export const structureDigestSchema = z.object({
  /** Top-level areas, largest first. */
  areas: z.array(z.object({ path: z.string(), files: z.number() })),
  /** Dominant file extensions, largest first. */
  extensions: z.array(z.object({ ext: z.string(), files: z.number() })),
  /** Root-level config and manifest files, which identify the stack. */
  markers: z.array(z.string()),
  totalFiles: z.number(),
  /** True when GitHub capped the listing, so counts are a floor, not a total. */
  truncated: z.boolean(),
});

export type StructureDigest = z.infer<typeof structureDigestSchema>;

const MAX_AREAS = 12;
const MAX_EXTENSIONS = 8;
const MAX_MARKERS = 12;

/** Root files that identify a stack at a glance rather than by guesswork. */
const MARKER_PATTERN =
  /^(package\.json|tsconfig[^/]*\.json|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml|pom\.xml|build\.gradle[^/]*|Gemfile|composer\.json|Dockerfile|docker-compose[^/]*\.ya?ml|Makefile|\.gitignore|README[^/]*|LICENSE[^/]*|CONSTITUTION\.md|CONTRIBUTING\.md)$/i;

function rank<T>(counts: Map<string, number>, limit: number, key: (k: string, n: number) => T): T[] {
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => key(name, count));
}

export function summarizeStructure(paths: string[], truncated = false): StructureDigest {
  const areas = new Map<string, number>();
  const extensions = new Map<string, number>();
  const markers: string[] = [];

  for (const path of paths) {
    const slash = path.indexOf("/");
    // A root-level file is its own area: "everything at the top" is a real
    // shape, and lumping it under a fake directory would hide it.
    const area = slash === -1 ? "(root)" : path.slice(0, slash);
    areas.set(area, (areas.get(area) ?? 0) + 1);

    const dot = path.lastIndexOf(".");
    const cut = Math.max(path.lastIndexOf("/"), 0);
    if (dot > cut) extensions.set(path.slice(dot), (extensions.get(path.slice(dot)) ?? 0) + 1);

    if (slash === -1 && MARKER_PATTERN.test(path) && markers.length < MAX_MARKERS) {
      markers.push(path);
    }
  }

  return {
    areas: rank(areas, MAX_AREAS, (path, files) => ({ path, files })),
    extensions: rank(extensions, MAX_EXTENSIONS, (ext, files) => ({ ext, files })),
    markers,
    totalFiles: paths.length,
    truncated,
  };
}
