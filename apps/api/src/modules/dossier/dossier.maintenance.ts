/**
 * The scheduled half of the dossier — the part that runs with no push at all.
 *
 * This is what makes the system resist stale data rather than merely support
 * it: decay is a function of elapsed time, so a member who stopped pushing must
 * still have their standing re-aged, their expired notes dropped, and their
 * narrative rewritten once the facts have moved enough to matter.
 */

import { LEDGER_KINDS } from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { createLogger, describeError } from "@/core/logger/logger.js";
import { computeFacts, persistFacts, pruneExpiredNotes } from "./dossier.service.js";
import { enrichPendingCommits, syncRepoConstitution } from "./enrichment.service.js";
import { reviewPendingCommits } from "./review.service.js";
import { refreshNarrative } from "./narrative.service.js";

const log = createLogger("dossier-maintenance");

/** Bounded per cycle so a large team cannot stall the tick or burn rate limit. */
const MAX_NARRATIVES_PER_CYCLE = 5;

/**
 * The App-dependent enrichment for one repository: line counts, code reviews,
 * and the cached rules document. Each is best-effort and independent — one
 * failing must not skip the others or abort the cycle.
 */
async function enrichRepository(repositoryId: string): Promise<void> {
  await enrichPendingCommits(repositoryId).catch((error: unknown) =>
    log.warn("enrichment failed", { repositoryId, error: String(error) }),
  );
  await reviewPendingCommits(repositoryId).catch((error: unknown) =>
    log.warn("review failed", { repositoryId, error: String(error) }),
  );
  await syncRepoConstitution(repositoryId).catch(() => false);
}

/**
 * One member: standing always, narrative only when the budget allows and the
 * facts actually moved. Returns whether a narrative was written — the caller
 * counts that, and nothing else here needs to know about the budget.
 */
async function refreshMember(
  repositoryId: string,
  login: string,
  narrativeAllowed: boolean,
): Promise<boolean> {
  const facts = await computeFacts(repositoryId, login);
  await persistFacts(repositoryId, facts);

  if (!narrativeAllowed) return false;

  const existing = await prisma.memberDossier.findUnique({
    where: { repositoryId_login: { repositoryId, login } },
    select: { narrativeFingerprint: true },
  });
  if (existing?.narrativeFingerprint === facts.fingerprint) return false;

  return refreshNarrative(repositoryId, login);
}

/**
 * One repository's members. Returns how many narratives it wrote so the cycle
 * budget is spent *across* repositories — a per-repository budget would let
 * whichever one is iterated first consume the whole tick every time.
 */
async function refreshRepository(repositoryId: string, budget: number): Promise<number> {
  await enrichRepository(repositoryId);

  // Any kind: a dossier ages whether its entries accuse or credit.
  const logins = await prisma.ledgerEvent.findMany({
    where: { repositoryId, kind: { in: [...LEDGER_KINDS] } },
    distinct: ["login"],
    select: { login: true },
  });

  let written = 0;
  for (const { login } of logins) {
    if (await refreshMember(repositoryId, login, written < budget)) written += 1;
  }
  return written;
}

export async function refreshDossiers(): Promise<void> {
  try {
    const expired = await pruneExpiredNotes();
    if (expired > 0) log.info("expired notes dropped", { expired });

    const repositories = await prisma.repository.findMany({
      where: { enabled: true },
      select: { id: true },
    });

    let narrativesWritten = 0;

    for (const repository of repositories) {
      narrativesWritten += await refreshRepository(
        repository.id,
        MAX_NARRATIVES_PER_CYCLE - narrativesWritten,
      );
    }

    if (narrativesWritten > 0) log.info("narratives regenerated", { narrativesWritten });
  } catch (error) {
    log.error("maintenance cycle failed", describeError(error));
  }
}
