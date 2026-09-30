/**
 * What a merge wrote inside a file both sides changed (D-25).
 *
 * `merge_residue` reads paths: a path the merge changed that no commit it brings
 * changed is the merge's own. A conflicted file fails that test by definition —
 * the branch changed it — so a line the merger added while resolving it went
 * unseen. Here the file is read line by line: a line in the merge's version
 * that is in neither parent's is the merger's own. git's own merge never
 * writes such a line — it only takes each side's — so this cannot charge an
 * honest resolution. What it misses — a line copied from elsewhere in either
 * side — it misses in silence.
 */

import type { LandingSides } from "./landing.js";

/** A file both sides changed that the merge left matching neither: its three versions. */
export interface Resolution {
  path: string;
  first: string;
  second: string;
  merged: string;
}

/** The files worth reading line by line: both sides changed them, and the merge took neither side's version. */
export function resolutionsOf(sides: LandingSides): Resolution[] {
  const found: Resolution[] = [];
  for (const [path, merged] of sides.merged) {
    const first = sides.first.get(path);
    const second = sides.second.get(path);
    const fork = sides.fork.get(path);
    if (first === undefined || second === undefined) continue;
    const bothChanged = first !== fork && second !== fork;
    if (bothChanged && merged !== first && merged !== second) found.push({ path, first, second, merged });
  }
  return found;
}

/**
 * The paths where the merge wrote a line neither parent had. A blank line is
 * not work. A version whose content was not read names nothing: an unread file
 * is not a guilty one.
 */
export function writtenInResolution(sides: LandingSides, contents: ReadonlyMap<string, string>): string[] {
  return resolutionsOf(sides).flatMap((file) => {
    const [first, second, merged] = [file.first, file.second, file.merged].map((sha) => contents.get(sha));
    if (first === undefined || second === undefined || merged === undefined) return [];
    const had = new Set([...linesOf(first), ...linesOf(second)]);
    return linesOf(merged).some((line) => !had.has(line)) ? [file.path] : [];
  });
}

const linesOf = (text: string): string[] => text.split(/\r?\n/).filter((line) => line.trim() !== "");
