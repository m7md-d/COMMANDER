import type { Member as PrismaMember, Repository as PrismaRepository } from "@prisma/client";
import type { ProjectStage, Repository } from "@commander/shared";
import {
  DEFAULT_PROJECT_STAGE,
  DEFAULT_SCHEDULE,
  PROJECT_STAGES,
  schedulesSchema,
  watchersSchema,
} from "@commander/shared";
import { mergeWithDefaults } from "@/domain/violations/engine.js";
import { readCheckMap } from "@/modules/checks/templates.service.js";

type RepositoryRow = PrismaRepository & { members: PrismaMember[] };

/**
 * The only place Prisma row shapes become API DTOs. Keeping it separate means
 * a column rename touches one file, and controllers never see a Prisma type.
 */
export function toRepositoryDto(row: RepositoryRow): Repository {
  return {
    id: row.id,
    fullName: row.fullName,
    enabled: row.enabled,
    branches: row.branches,
    discordWebhookUrl: row.discordWebhookUrl,
    model: row.model,
    promptId: row.promptId,
    silentWhenClean: row.silentWhenClean,
    projectBrief: row.projectBrief,
    // A JSON column is only as good as its read-time check: anything malformed
    // degrades to "no watchers" rather than failing the whole repository read.
    watchers: watchersSchema.safeParse(row.watchers).data ?? [],
    // Same read-time contract: a row written before this column existed, or one
    // hand-edited into nonsense, falls back to the shipped rhythm rather than
    // silently never reporting.
    schedules: schedulesSchema.safeParse(row.schedules).data ?? { weekly_digest: DEFAULT_SCHEDULE },
    // Stored as text so a new stage needs no migration; validated on the way in,
    // so an unknown value here means hand-edited data and falls back to neutral.
    projectStage: (PROJECT_STAGES as readonly string[]).includes(row.projectStage)
      ? (row.projectStage as ProjectStage)
      : DEFAULT_PROJECT_STAGE,
    githubInstallationId: row.githubInstallationId,
    lastScannedAt: row.lastScannedAt?.toISOString() ?? null,
    // Stored JSON is layered over defaults so a row written before a rule
    // existed still yields a complete config.
    rules: mergeWithDefaults(row.rules),
    checkTemplateId: row.checkTemplateId,
    // The partial the front stated, not the resolved result: the panel edits
    // overrides, and showing it a flattened map would make every inherited value
    // look like something this front had chosen for itself.
    checks: readCheckMap(row.checks),
    members: row.members.map((member) => ({
      id: member.id,
      repositoryId: member.repositoryId,
      login: member.login,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      rank: member.rank,
      note: member.note,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** An empty branch list means "every branch"; a trailing * is the only wildcard. */
export function branchIsWatched(branches: string[], branch: string): boolean {
  if (branches.length === 0) return true;

  return branches.some((pattern) => {
    const clean = pattern.trim();
    if (!clean) return false;
    if (clean === "*") return true;
    if (clean.endsWith("*")) return branch.startsWith(clean.slice(0, -1));
    return clean === branch;
  });
}
