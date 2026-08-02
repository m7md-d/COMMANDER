/**
 * The stored file tree of a watched repository.
 *
 * This is a different artefact from `StructureDigest`: the digest compresses a
 * repository to something a prompt can carry, while this is the record itself —
 * one row per file, carrying the facts a check will later be measured against.
 * The digest can be regenerated from the tree; the reverse is not true.
 */

/** One member's share of a path, accumulated from enriched commits. */
import type { CheckMetric } from "../domain/checks.js";

export interface TreeOwner {
  login: string;
  displayName: string;
  linesAdded: number;
  commitCount: number;
}

export interface TreeFile {
  path: string;
  /** GitHub's blob sha. The fingerprint that decides whether content moved —
   *  and the key the measurement is stored under, so a rename or a revert
   *  costs nothing to re-measure. */
  blobSha: string;
  /** From the tree listing, free of charge. Always known. */
  bytes: number;
  /** Every metric's reading for this blob. Null on any one of them means *not
   *  measured*, never zero — and the three are independent: a file can have a
   *  line count and no depth, because its braces did not balance under our
   *  reading and a guess is worse than a gap. */
  metrics: Record<CheckMetric, number | null>;
  /** What this path already measured the first time it could be counted. Null
   *  until then. Anything over the limit at that moment is inherited, and the
   *  record says so rather than charging it to whoever edits the file next. */
  baseline: number | null;
  /** Most lines first. Empty for a path no enriched commit has touched. */
  owners: TreeOwner[];
  /** Null when nothing enriched has ever touched this path. */
  lastTouchedAt: string | null;
}

export interface TreeSnapshot {
  files: TreeFile[];
  /** The git tree sha this snapshot was built from. Storing it is what makes a
   *  later finding re-derivable rather than merely asserted. */
  treeSha: string;
  /** Null means never synced — a different fact from "found no files", and only
   *  one of the two is the operator's problem. */
  syncedAt: string | null;
  /** GitHub capped the listing. The snapshot is a floor, not a total, and no
   *  amount of retrying changes that. */
  truncated: boolean;
  /** We capped the response ourselves. The snapshot is complete; the view is
   *  partial. Separate from `truncated` because only this one is ours to fix. */
  capped: boolean;
  /** Files in the stored snapshot, which is `files.length` unless `capped`. */
  totalFiles: number;
}
