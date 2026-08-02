/**
 * What one push leaves in the record, written while the communiqué is still
 * being composed.
 *
 * Split from the processor because the processor's job is deciding whether a
 * report happens; this decides what survives it. A failure here is logged rather
 * than thrown for that reason: the standing can always be rebuilt from the rows
 * that did land, and the communiqué cannot be rebuilt at all.
 */

import type { Commendation, NormalizedPush, ViolationHit } from "@commander/shared";
import { createLogger } from "@/core/logger/logger.js";
import {
  recordCommendations,
  recordCommits,
  recordViolations,
} from "@/modules/dossier/dossier.ledger.js";

const log = createLogger("processor");

/**
 * Evidence ledger: individual timestamped rows, which is what lets the dossier
 * decay and discount later. A failure here must not lose the report, so it is
 * logged rather than thrown — the score can be rebuilt, the communiqué cannot.
 */
export async function writeLedger(input: {
  repositoryId: string;
  push: NormalizedPush;
  violations: ViolationHit[];
  commendations: Commendation[];
  deliveryId: string;
}): Promise<void> {
  const { repositoryId, push, violations, commendations, deliveryId } = input;
  const when = new Date();

  await Promise.all([
    recordViolations({
      repositoryId,
      login: push.actorLogin,
      entries: violations,
      occurredAt: when,
      deliveryId,
    }),
    // The same timestamp and the same delivery id: both directions of one push
    // are one event in the record, and dating them apart would let the timeline
    // show a person fixing something before they were charged for it.
    recordCommendations({
      repositoryId,
      login: push.actorLogin,
      entries: commendations,
      occurredAt: when,
      deliveryId,
    }),
    recordCommits({
      repositoryId,
      login: push.actorLogin,
      commits: push.commits.map((commit) => ({
        sha: commit.sha,
        title: commit.title,
        timestamp: commit.timestamp,
        filesTouched: commit.filesAdded + commit.filesRemoved + commit.filesModified,
      })),
    }),
  ]).catch((error: unknown) => log.error("dossier ledger write failed", { error: String(error) }));
}
