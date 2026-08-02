import {
  factsFingerprint,
  LEDGER_KINDS,
  scoreDossier,
  type RuleId,
  type ScoredEvent,
} from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { toJson } from "@/core/json.js";
import { createLogger } from "@/core/logger/logger.js";

const log = createLogger("dossier");

/**
 * Standing, recomputed from the ledger in apps/api/src/modules/dossier/dossier.ledger.ts.
 * Nothing here writes evidence; it only reads it and decides what it is worth.
 */
export interface DossierFacts {
  login: string;
  riskScore: number;
  tier: string;
  cleanStreakDays: number;
  anomalyCount: number;
  scoreByRule: Partial<Record<RuleId, number>>;
  totalCommits: number;
  totalPushes: number;
  totalViolations: number;
  topFiles: { path: string; linesAdded: number; linesRemoved: number }[];
  recentEvents: { ruleId: string; occurredAt: string; weight: number; anomaly: boolean }[];
  fingerprint: string;
}

/** Every row the recomputation reads, in one round trip. */
function loadLedger(repositoryId: string, login: string) {
  return Promise.all([
    // Violations only: the risk score is a measure of what someone is charged
    // with, and letting a commendation into this list would silently *raise* it.
    prisma.ledgerEvent.findMany({
      where: { repositoryId, login, kind: "violation" },
      orderBy: { occurredAt: "asc" },
      select: { ruleId: true, occurredAt: true },
    }),
    prisma.memberStat.findUnique({ where: { repositoryId_login: { repositoryId, login } } }),
    prisma.fileAttribution.findMany({
      where: { repositoryId, login },
      orderBy: { linesAdded: "desc" },
      take: 8,
    }),
  ]);
}

/**
 * Only the live tail is carried into the DTO and the narrative; everything
 * older is already summarised by the decayed score, and quoting it would invite
 * the model to describe events that no longer weigh anything.
 */
function liveTail(events: ScoredEvent[]): DossierFacts["recentEvents"] {
  return events.slice(-12).map((event) => ({
    ruleId: event.ruleId,
    occurredAt: event.occurredAt,
    weight: Number(event.weight.toFixed(3)),
    anomaly: event.discountedAsAnomaly,
  }));
}

/**
 * Recomputes standing from the evidence ledger.
 *
 * Deliberately a full recomputation rather than an incremental update: decay
 * means every stored score is stale the moment it is written, so there is no
 * "current" value to increment. Recomputing is also what makes the system
 * immune to drift — the numbers can always be re-derived from the events.
 */
export async function computeFacts(repositoryId: string, login: string): Promise<DossierFacts> {
  const [events, stat, files] = await loadLedger(repositoryId, login);

  const scored = scoreDossier(
    events.map((event) => ({
      ruleId: event.ruleId as RuleId,
      occurredAt: event.occurredAt.toISOString(),
    })),
  );

  const topFiles = files.map((file) => ({
    path: file.path,
    linesAdded: file.linesAdded,
    linesRemoved: file.linesRemoved,
  }));

  return {
    login,
    riskScore: Number(scored.riskScore.toFixed(3)),
    tier: scored.tier,
    cleanStreakDays: Number(scored.cleanStreakDays.toFixed(1)),
    anomalyCount: scored.anomalyCount,
    scoreByRule: scored.byRule,
    totalCommits: stat?.totalCommits ?? 0,
    totalPushes: stat?.totalPushes ?? 0,
    totalViolations: events.length,
    topFiles,
    recentEvents: liveTail(scored.events),
    fingerprint: factsFingerprint({
      tier: scored.tier,
      riskScore: scored.riskScore,
      totalCommits: stat?.totalCommits ?? 0,
      totalPushes: stat?.totalPushes ?? 0,
      topFiles: topFiles.map((file) => file.path),
    }),
  };
}

/** Persists the computed standing. The narrative is handled separately. */
export async function persistFacts(repositoryId: string, facts: DossierFacts): Promise<void> {
  await prisma.memberDossier.upsert({
    where: { repositoryId_login: { repositoryId, login: facts.login } },
    create: {
      repositoryId,
      login: facts.login,
      riskScore: facts.riskScore,
      toleranceTier: facts.tier,
      cleanStreakDays: facts.cleanStreakDays,
      anomalyCount: facts.anomalyCount,
      scoreByRule: toJson(facts.scoreByRule),
    },
    update: {
      riskScore: facts.riskScore,
      toleranceTier: facts.tier,
      cleanStreakDays: facts.cleanStreakDays,
      anomalyCount: facts.anomalyCount,
      scoreByRule: toJson(facts.scoreByRule),
      computedAt: new Date(),
    },
  });
}

/**
 * Recomputes every dossier in a repository. Cheap enough to run on a schedule,
 * which matters because decay changes scores with no new events at all — a
 * dossier left alone still needs to age.
 */
export async function refreshRepository(repositoryId: string): Promise<number> {
  // Every kind, unlike the scoring read above: this asks *who has a record at
  // all*, and someone whose only entries are commendations still has one.
  const logins = await prisma.ledgerEvent.findMany({
    where: { repositoryId, kind: { in: [...LEDGER_KINDS] } },
    distinct: ["login"],
    select: { login: true },
  });

  for (const { login } of logins) {
    persistFacts(repositoryId, await computeFacts(repositoryId, login)).catch((error: unknown) =>
      log.error("refresh failed", { login, error: String(error) }),
    );
  }

  return logins.length;
}

/** Expired notes stop counting against a member automatically. */
export async function pruneExpiredNotes(): Promise<number> {
  const { count } = await prisma.dossierNote.deleteMany({
    where: { expiresAt: { not: null, lt: new Date() } },
  });
  return count;
}
