/**
 * What moved between a stored snapshot and a fresh listing.
 *
 * The one place in the tree subsystem where a decision is made, so it lives in
 * the domain: pure, no database, no network, testable on its own. Every later
 * finding — who crossed a threshold, what is inherited — is read off these three
 * lists, and a file put in the wrong one is not a cosmetic bug.
 */

/** Anything with a path and a content hash. Generic so the caller keeps whatever
 *  else its entries carry (byte lengths, for instance) through the sort. */
export interface TreeEntry {
  path: string;
  sha: string;
}

export interface StoredFile {
  path: string;
  blobSha: string;
}

/** One path this listing moved, with the blob it moved *from*. */
export interface TouchedFile {
  path: string;
  sha: string;
  /** The blob previously at this path. Null when the file is new. */
  previousSha: string | null;
}

export interface TreeChanges<T extends TreeEntry = TreeEntry> {
  added: T[];
  /** Same path, different content. Updated in place — never replaced — so the
   *  row's `firstSeenAt` survives to anchor a baseline. */
  changed: T[];
  removed: string[];
  /**
   * Added and changed together, each carrying what was there before.
   *
   * The writer does not need this; the checks do. Once the sync has run, the
   * old sha is gone from the table, so "what was this file before" has to be
   * captured here or not at all — and without it a crossing cannot be told from
   * a file that was already over the limit.
   */
  touched: TouchedFile[];
}

export function diffTree<T extends TreeEntry>(stored: StoredFile[], entries: T[]): TreeChanges<T> {
  const before = new Map(stored.map((row) => [row.path, row.blobSha]));
  const present = new Set(entries.map((entry) => entry.path));

  const added = entries.filter((entry) => !before.has(entry.path));
  const changed = entries.filter((entry) => {
    const previous = before.get(entry.path);
    // Undefined means the path is new, which is an addition rather than a
    // change: comparing against undefined would put it in both lists.
    return previous !== undefined && previous !== entry.sha;
  });

  return {
    added,
    changed,
    removed: stored.filter((row) => !present.has(row.path)).map((row) => row.path),
    touched: [...added, ...changed].map((entry) => ({
      path: entry.path,
      sha: entry.sha,
      previousSha: before.get(entry.path) ?? null,
    })),
  };
}
