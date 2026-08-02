import type {
  DossierNote,
  DossierReview,
  MemberDossier,
  RuleId,
  ToleranceTier,
} from "@commander/shared";
import { commitReviewSchema, computeAchievements, type LedgerKind } from "@commander/shared";
import { NotFoundError } from "@/core/errors/app-error.js";
import { prisma } from "@/db/prisma.js";
import { computeFacts, persistFacts } from "./dossier.service.js";
import { toDossierDto, toNoteDto } from "./dossier.mapper.js";

/**
 * Always recomputes before returning.
 *
 * Opening a dossier must never show a score that was correct last week — decay
 * has moved it since. The stored row is a cache for listings; the detail view
 * is the authoritative read.
 */
export async function getDossier(repositoryId: string, login: string): Promise<MemberDossier> {
  const facts = await computeFacts(repositoryId, login);
  await persistFacts(repositoryId, facts);

  const data = await loadDossierRows(repositoryId, login);
  if (!data.row) throw new NotFoundError("dossier.empty");

  const ruleCounts: Partial<Record<RuleId, number>> = {};
  for (const entry of data.ruleCountRows) ruleCounts[entry.ruleId as RuleId] = entry._count._all;

  const achievements = computeAchievements({
    tier: facts.tier as ToleranceTier,
    cleanStreakDays: facts.cleanStreakDays,
    totalCommits: facts.totalCommits,
    totalPushes: facts.totalPushes,
    totalViolations: facts.totalViolations,
    ruleCounts,
  });

  return toDossierDto({
    login,
    facts,
    row: data.row,
    member: data.member,
    files: data.files,
    notes: data.notes,
    enriched: data.enrichedCount > 0,
    achievements,
    reviews: mapReviews(data.reviewRows),
    commendations: data.credits.reduce((sum, entry) => sum + entry._count._all, 0),
  });
}

/** One round-trip for the detail view's rows. Split out so getDossier reads as
 *  its intent — recompute, assemble, return — not as seven queries. */
function loadDossierRows(repositoryId: string, login: string) {
  return Promise.all([
    prisma.memberDossier.findUnique({ where: { repositoryId_login: { repositoryId, login } } }),
    prisma.member.findFirst({ where: { repositoryId, login } }),
    prisma.fileAttribution.findMany({
      where: { repositoryId, login },
      orderBy: { linesAdded: "desc" },
      take: 12,
    }),
    prisma.dossierNote.findMany({
      where: { repositoryId, login },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.commitRecord.count({ where: { repositoryId, enriched: true } }),
    // Lifetime raw counts per rule — the basis of the signature reprimands, and
    // now of the credits beside them. Neither decays the way the score does.
    countByRule(repositoryId, login, "violation"),
    countByRule(repositoryId, login, "commendation"),
    prisma.commitRecord.findMany({
      where: { repositoryId, login, reviewedAt: { not: null } },
      orderBy: { committedAt: "desc" },
      take: 10,
      select: { sha: true, title: true, committedAt: true, review: true },
    }),
  ]).then(([row, member, files, notes, enrichedCount, ruleCountRows, credits, reviewRows]) => ({
    row,
    member,
    files,
    notes,
    enrichedCount,
    ruleCountRows,
    credits,
    reviewRows,
  }));
}

/** One kind's lifetime tally per rule. The kind is a parameter here because the
 *  caller asks for both and must not be able to conflate them. */
function countByRule(repositoryId: string, login: string, kind: LedgerKind) {
  return prisma.ledgerEvent.groupBy({
    by: ["ruleId"],
    where: { repositoryId, login, kind },
    _count: { _all: true },
  });
}

/**
 * A stored review is JSON, so its shape is asserted here; a verdict-less row
 * (an unresolvable sha, or output that was not valid JSON) simply drops out.
 */
function mapReviews(
  rows: { sha: string; title: string; committedAt: Date; review: unknown }[],
): DossierReview[] {
  return rows.flatMap((record) => {
    const parsed = commitReviewSchema.safeParse(record.review);
    if (!parsed.success) return [];
    return [{
      sha: record.sha,
      title: record.title,
      committedAt: record.committedAt.toISOString(),
      ...parsed.data,
    }];
  });
}

export async function addNote(input: {
  repositoryId: string;
  login: string;
  body: string;
  expiresInDays?: number;
}): Promise<DossierNote> {
  const row = await prisma.dossierNote.create({
    data: {
      repositoryId: input.repositoryId,
      login: input.login,
      body: input.body,
      kind: "manual",
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000)
        : null,
    },
  });

  return toNoteDto(row);
}

export async function deleteNote(id: string): Promise<void> {
  await prisma.dossierNote.delete({ where: { id } });
}
