import type {
  DossierNote as NoteRow,
  FileAttribution as FileRow,
  Member as MemberRow,
  MemberDossier as DossierRow,
} from "@prisma/client";
import type {
  Achievement,
  DossierNote,
  DossierReview,
  MemberDossier,
  RuleId,
  ToleranceTier,
} from "@commander/shared";
import type { DossierFacts } from "./dossier.service.js";

/**
 * The only place dossier rows become API DTOs. Separated from the read service
 * for the same reason as every other mapper here: a column rename touches one
 * file, and controllers never see a Prisma type.
 */

/** Stored as JSON, so its shape is asserted on read rather than trusted. */
export function readScoreMap(value: unknown): Partial<Record<RuleId, number>> {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  ) as Partial<Record<RuleId, number>>;
}

export function toNoteDto(row: NoteRow): DossierNote {
  return {
    id: row.id,
    body: row.body,
    kind: row.kind === "auto" ? "auto" : "manual",
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

interface DossierDtoInput {
  login: string;
  facts: DossierFacts;
  row: DossierRow;
  member: MemberRow | null;
  files: FileRow[];
  notes: NoteRow[];
  enriched: boolean;
  achievements: Achievement[];
  reviews: DossierReview[];
  commendations: number;
}

/**
 * Scores come from `facts` (just recomputed), prose and timestamps from `row`
 * (the persisted cache). Mixing the two sources is deliberate and is why this
 * assembly is worth naming: the numbers must never be the stale ones.
 */
export function toDossierDto(input: DossierDtoInput): MemberDossier {
  const { facts, row } = input;

  return {
    login: input.login,
    displayName: input.member?.displayName ?? "",
    rank: input.member?.rank ?? "",
    tier: facts.tier as ToleranceTier,
    riskScore: facts.riskScore,
    cleanStreakDays: facts.cleanStreakDays,
    anomalyCount: facts.anomalyCount,
    scoreByRule: readScoreMap(facts.scoreByRule),
    totalCommits: facts.totalCommits,
    totalPushes: facts.totalPushes,
    totalViolations: facts.totalViolations,
    totalCommendations: input.commendations,
    events: facts.recentEvents.map((event) => ({
      ruleId: event.ruleId as RuleId,
      occurredAt: event.occurredAt,
      weight: event.weight,
      anomaly: event.anomaly,
    })),
    files: input.files.map((file) => ({
      path: file.path,
      linesAdded: file.linesAdded,
      linesRemoved: file.linesRemoved,
      commitCount: file.commitCount,
      lastTouchedAt: file.lastTouchedAt.toISOString(),
    })),
    notes: input.notes.map(toNoteDto),
    achievements: input.achievements,
    reviews: input.reviews,
    narrative: row.narrative,
    narrativeUpdatedAt: row.narrativeUpdatedAt?.toISOString() ?? null,
    enriched: input.enriched,
    computedAt: row.computedAt.toISOString(),
  };
}
