/**
 * The content side of what GitHub serves — a commit's file listing and the
 * blobs in it — which is what the checks measure. Split from
 * `github.test.kit.ts`, which models what GitHub says about pushes and commits.
 *
 * | What               | Model                                                   | Source |
 * |--------------------|---------------------------------------------------------|--------|
 * | trees API          | every blob of the commit's tree, recursive, never cut   | GitHub docs, "Get a tree", `recursive=1` |
 * | blob measurements  | every blob measured, the worker's own way (`readingOf`) | assumption: the sweep has finished, the steady state |
 */

import { readingOf, type Reading } from "@/domain/checks/judge.js";
import type { Git } from "./git.test.kit.js";

export interface Listed {
  path: string;
  sha: string;
  bytes: number;
}

export class Contents {
  /** `blob_metrics`: keyed by content, so a blob is read once however often it recurs. */
  private readonly readings = new Map<string, Reading>();

  constructor(private readonly git: Git) {}

  /** `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`: every blob, with its size. */
  async tree(commit: string): Promise<Listed[]> {
    const out = await this.git.run(["ls-tree", "-r", "-l", "-z", commit]);
    return out.split("\0").flatMap((record) => {
      // "<mode> blob <sha> <size>\t<path>"
      const [meta = "", path = ""] = record.split("\t");
      const [, type, sha = "", size] = meta.trim().split(/\s+/);
      return type === "blob" && path ? [{ path, sha, bytes: Number(size) }] : [];
    });
  }

  /** The measurements of these blobs, read from git the first time each is seen. */
  async measure(files: { path: string; sha: string }[]): Promise<ReadonlyMap<string, Reading>> {
    const missing = files.filter((file) => !this.readings.has(file.sha));
    if (missing.length === 0) return this.readings;

    const input = missing.map((file) => file.sha).join("\n") + "\n";
    const contents = parseBatch(await this.git.feed(["cat-file", "--batch"], input));
    for (const file of missing) {
      const content = contents.get(file.sha);
      if (content !== undefined) this.readings.set(file.sha, readingOf(file.path, content));
    }
    return this.readings;
  }
}

/** `git cat-file --batch`: "<sha> blob <bytes>\n<content>\n" per object, sized in bytes. */
function parseBatch(out: string): Map<string, string> {
  const buffer = Buffer.from(out, "utf8");
  const found = new Map<string, string>();
  let at = 0;

  while (at < buffer.length) {
    const eol = buffer.indexOf(0x0a, at);
    if (eol < 0) break;
    const [sha = "", type, size] = buffer.toString("utf8", at, eol).split(" ");
    if (type !== "blob") {
      at = eol + 1;
      continue;
    }
    const end = eol + 1 + Number(size);
    found.set(sha, buffer.toString("utf8", eol + 1, end));
    at = end + 1;
  }
  return found;
}
