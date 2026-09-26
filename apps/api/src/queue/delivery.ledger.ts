/**
 * What one push leaves in the record, written while the communiqué is still
 * being composed.
 *
 * Split from the processor because the processor's job is deciding whether a
 * report happens; this decides what survives it. A failure here is logged rather
 * than thrown for that reason: the standing can always be rebuilt from the rows
 * that did land, and the communiqué cannot be rebuilt at all.
 */

import type { NormalizedPush } from "@commander/shared";
import { createLogger } from "@/core/logger/logger.js";
import { filedUnder } from "@/domain/judgement/attribution.js";
import type { Judgement } from "@/domain/judgement/judgement.js";
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
 *
 * Every row goes to the login its entry carries, and every commit to the member
 * `filedUnder` names. Who answers for a push is a decision, and decisions are
 * `judgePush`'s — this file only writes it down, and says what it left out.
 */
export async function writeLedger(input: {
  repositoryId: string;
  push: NormalizedPush;
  judgement: Pick<Judgement, "violations" | "commendations" | "unattributed" | "mainLine">;
  deliveryId: string;
}): Promise<void> {
  const { repositoryId, push, judgement, deliveryId } = input;
  const row = { repositoryId, occurredAt: new Date(), deliveryId, branch: push.branch, mainLine: judgement.mainLine };

  if (judgement.unattributed.length > 0) {
    // For the operator: found, and charged to nobody, because nothing named anyone.
    log.info("findings nobody answers for", {
      repo: push.repoFullName,
      branch: push.branch,
      rules: judgement.unattributed.map((entry) => entry.ruleId),
    });
  }

  await Promise.all([
    recordViolations({ ...row, entries: judgement.violations }),
    // The same timestamp and the same delivery id: both directions of one push
    // are one event in the record, and dating them apart would let the timeline
    // show a person fixing something before they were charged for it.
    recordCommendations({ ...row, entries: judgement.commendations }),
    recordCommits({
      repositoryId,
      commits: push.commits.map((commit) => ({
        sha: commit.sha,
        login: filedUnder(commit, push),
        title: commit.title,
        timestamp: commit.timestamp,
        filesTouched: commit.filesAdded + commit.filesRemoved + commit.filesModified,
      })),
    }),
  ]).catch((error: unknown) => log.error("dossier ledger write failed", { error: String(error) }));
}
