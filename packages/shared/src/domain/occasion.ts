/**
 * Why a report is being written.
 *
 * Until now every dispatch had one cause: a push arrived. A weekly digest has a
 * different one — time passed — and the outbox has to carry both, because that
 * is where retry, backoff and "nothing is ever lost" already live. Giving the
 * digest its own delivery path would mean writing all three again, worse.
 *
 * So the stored payload becomes an occasion with a kind, and the processor
 * switches on it. Everything downstream of "what does this report say" stays
 * exactly as it was.
 */

import type { NormalizedPush } from "./push.js";

export const OCCASION_KINDS = ["push", "weekly_digest"] as const;

export type OccasionKind = (typeof OCCASION_KINDS)[number];

export interface PushOccasion {
  kind: "push";
  push: NormalizedPush;
}

/**
 * What caused a digest to be written — and, more importantly, what it is
 * allowed to change.
 *
 * A scheduled digest owns the schedule: it closes the window, moves the anchor
 * and stores the code state the next one compares against. A manual one owns
 * nothing. It is a reading, and a reading that consumed the week would make the
 * button a trap: press it on Sunday and Monday's report silently never comes.
 *
 * Absent on rows queued before this field existed, and read as "schedule" there,
 * which is what they were.
 */
export type DigestTrigger = "schedule" | "manual";

export interface DigestOccasion {
  kind: "weekly_digest";
  repositoryId: string;
  repoFullName: string;
  /** The window this digest covers, inclusive of `since`, exclusive of `until`.
   *  Stored rather than recomputed at delivery time so a retry three hours later
   *  reports the same week, not a window that has quietly slid forward. */
  since: string;
  until: string;
  trigger?: DigestTrigger;
}

/** Defaulted here rather than at every call site, so a payload that predates the
 *  field cannot be mistaken for a manual one and skip the state it owes. */
export function digestTrigger(occasion: DigestOccasion): DigestTrigger {
  return occasion.trigger === "manual" ? "manual" : "schedule";
}

export type Occasion = PushOccasion | DigestOccasion;

/**
 * Reads a stored payload, tolerating the shape that predates occasions.
 *
 * Rows written before this existed hold a bare `NormalizedPush`. They are still
 * in the queue at the moment of deploy, and a deploy that stranded them would
 * lose exactly the reports the outbox exists to protect. The absence of `kind`
 * is the discriminator, and it is unambiguous: no push ever had that field.
 */
export function readOccasion(payload: unknown): Occasion | null {
  if (typeof payload !== "object" || payload === null) return null;

  const kind = (payload as { kind?: unknown }).kind;
  if (kind === "weekly_digest" || kind === "push") return payload as Occasion;

  // Legacy: a bare push. Recognised by the field every push carries and nothing
  // else does, rather than by "it has no kind" — which would also accept junk.
  if (typeof (payload as { repoFullName?: unknown }).repoFullName === "string") {
    return { kind: "push", push: payload as NormalizedPush };
  }

  return null;
}
