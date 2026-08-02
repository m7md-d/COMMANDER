/**
 * Writes to the evidence ledger — the append-only record everything else is
 * derived from. Kept apart from the scoring service because these two answer
 * different questions: this file records *what happened*, dossier.service.ts
 * decides *what it is currently worth*.
 *
 * Both directions are recorded here (see LedgerKind). Praise that lives only in
 * a Discord message is praise that stops existing the moment the channel scrolls,
 * while every accusation survives in the record forever — and a record with that
 * asymmetry built into it is not neutral, it is a case for the prosecution.
 */

import type { Commendation, LedgerKind, ViolationHit } from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { toJson } from "@/core/json.js";

interface LedgerWrite {
  repositoryId: string;
  login: string;
  entries: (ViolationHit | Commendation)[];
  occurredAt: Date;
  deliveryId: string;
}

/**
 * The two writers below are separate functions rather than one with a `kind`
 * parameter, and that is the whole safety argument: a kind you pass is a kind
 * you can forget, and a forgotten one defaults to `violation` — which would file
 * praise as an accusation. Choosing the function *is* choosing the kind.
 */
export function recordViolations(input: LedgerWrite): Promise<void> {
  return record("violation", input);
}

export function recordCommendations(input: LedgerWrite): Promise<void> {
  return record("commendation", input);
}

async function record(kind: LedgerKind, input: LedgerWrite): Promise<void> {
  if (input.entries.length === 0) return;

  await prisma.ledgerEvent.createMany({
    data: input.entries.map((entry) => ({
      repositoryId: input.repositoryId,
      login: input.login,
      kind,
      ruleId: entry.ruleId,
      occurredAt: input.occurredAt,
      detail: toJson(entry.detail),
      deliveryId: input.deliveryId,
    })),
  });
}

export async function recordCommits(input: {
  repositoryId: string;
  login: string;
  commits: { sha: string; title: string; timestamp: string; filesTouched: number }[];
}): Promise<void> {
  for (const commit of input.commits) {
    if (!commit.sha) continue;
    const committedAt = new Date(commit.timestamp);
    if (Number.isNaN(committedAt.getTime())) continue;

    // A force push can replay a sha we already hold; the unique index makes
    // this idempotent instead of double-counting.
    await prisma.commitRecord.upsert({
      where: { repositoryId_sha: { repositoryId: input.repositoryId, sha: commit.sha } },
      create: {
        repositoryId: input.repositoryId,
        sha: commit.sha,
        login: input.login,
        title: commit.title.slice(0, 300),
        committedAt,
        filesChanged: commit.filesTouched,
      },
      update: {},
    });
  }
}
