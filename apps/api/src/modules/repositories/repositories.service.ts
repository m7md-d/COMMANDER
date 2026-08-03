import type { Prisma } from "@prisma/client";
import { defaultRuleConfig, type Repository, type RepositoryInput, type RepositoryUpdate } from "@commander/shared";
import { ConflictError, NotFoundError } from "@/core/errors/app-error.js";
import { toJson } from "@/core/json.js";
import { isPrismaError, prisma, UNIQUE_CONSTRAINT } from "@/db/prisma.js";
import { toRepositoryDto } from "./repositories.mapper.js";

const withMembers = { members: { orderBy: { login: "asc" } } } as const;

export async function listRepositories(): Promise<Repository[]> {
  const rows = await prisma.repository.findMany({
    include: withMembers,
    orderBy: { fullName: "asc" },
  });
  return rows.map(toRepositoryDto);
}

export async function getRepository(id: string): Promise<Repository> {
  const row = await prisma.repository.findUnique({ where: { id }, include: withMembers });
  if (!row) throw new NotFoundError("repos.notFound");
  return toRepositoryDto(row);
}

/**
 * Case-insensitive because GitHub treats repository names that way, and the
 * webhook must match whatever casing the payload happens to carry.
 */
export async function findByFullName(fullName: string): Promise<Repository | null> {
  const row = await prisma.repository.findFirst({
    where: { fullName: { equals: fullName, mode: "insensitive" } },
    include: withMembers,
  });
  return row ? toRepositoryDto(row) : null;
}

export async function createRepository(input: RepositoryInput): Promise<Repository> {
  try {
    const row = await prisma.repository.create({
      data: {
        fullName: input.fullName,
        enabled: input.enabled,
        branches: input.branches,
        discordWebhookUrl: input.discordWebhookUrl,
        model: input.model,
        promptId: input.promptId,
        silentWhenClean: input.silentWhenClean,
        githubInstallationId: input.githubInstallationId,
        projectBrief: input.projectBrief,
        projectStage: input.projectStage,
        watchers: toJson(input.watchers),
        schedules: toJson(input.schedules),
        rules: input.rules ?? defaultRuleConfig(),
        checkTemplateId: input.checkTemplateId,
        checks: toJson(input.checks),
        members: { create: input.members },
      },
      include: withMembers,
    });
    return toRepositoryDto(row);
  } catch (error) {
    // Lost race against a concurrent create; the unique index is the authority.
    if (isPrismaError(error, UNIQUE_CONSTRAINT)) throw new ConflictError("repos.duplicate");
    throw error;
  }
}

/**
 * Members are replaced wholesale rather than diffed. The panel edits them as a
 * list, the list is small, and a replace inside one transaction is far simpler
 * to reason about than a three-way merge.
 *
 * The one thing a replace must NOT do is discard what the operator never typed.
 * `avatarUrl` is written by the repository scan and shown but not edited, so a
 * client that omits it sends "" — and a naive replace would erase a scan's work
 * on every roster save. The stored avatar is therefore carried across by login
 * whenever the incoming one is empty, which makes the loss impossible from any
 * client rather than only from the ones we remembered to fix.
 */
async function replaceMembers(
  tx: Prisma.TransactionClient,
  repositoryId: string,
  members: NonNullable<RepositoryUpdate["members"]>,
): Promise<void> {
  const stored = await tx.member.findMany({ where: { repositoryId } });
  const avatars = new Map(stored.map((member) => [member.login, member.avatarUrl]));

  await tx.member.deleteMany({ where: { repositoryId } });
  await tx.member.createMany({
    data: members.map((member) => ({
      ...member,
      avatarUrl: member.avatarUrl || avatars.get(member.login) || "",
      repositoryId,
    })),
  });
}

export async function updateRepository(id: string, patch: RepositoryUpdate): Promise<Repository> {
  await getRepository(id);

  try {
    const row = await prisma.$transaction(async (tx) => {
      if (patch.members) await replaceMembers(tx, id, patch.members);

      return tx.repository.update({
        where: { id },
        data: {
          ...(patch.fullName !== undefined && { fullName: patch.fullName }),
          ...(patch.enabled !== undefined && { enabled: patch.enabled }),
          ...(patch.branches !== undefined && { branches: patch.branches }),
          ...(patch.discordWebhookUrl !== undefined && { discordWebhookUrl: patch.discordWebhookUrl }),
          ...(patch.model !== undefined && { model: patch.model }),
          ...(patch.promptId !== undefined && { promptId: patch.promptId }),
          ...(patch.silentWhenClean !== undefined && { silentWhenClean: patch.silentWhenClean }),
          ...(patch.githubInstallationId !== undefined && { githubInstallationId: patch.githubInstallationId }),
          // Every field of the input contract is written here. Omitting one is a
          // silent no-op: the PATCH returns 200 carrying the old value and the
          // panel reports "saved" for an edit that never landed. It happened to
          // projectBrief and projectStage, then again to schedules — which is why
          // tests/coverage/contract-writes.test.ts now fails on the next omission
          // instead of a user finding it.
          ...(patch.projectBrief !== undefined && { projectBrief: patch.projectBrief }),
          ...(patch.projectStage !== undefined && { projectStage: patch.projectStage }),
          ...(patch.watchers !== undefined && { watchers: toJson(patch.watchers) }),
          ...(patch.schedules !== undefined && { schedules: toJson(patch.schedules) }),
          ...(patch.rules !== undefined && { rules: patch.rules }),
          ...(patch.checkTemplateId !== undefined && { checkTemplateId: patch.checkTemplateId }),
          ...(patch.checks !== undefined && { checks: toJson(patch.checks) }),
        },
        include: withMembers,
      });
    });

    return toRepositoryDto(row);
  } catch (error) {
    if (isPrismaError(error, UNIQUE_CONSTRAINT)) throw new ConflictError("repos.duplicate");
    throw error;
  }
}

export async function deleteRepository(id: string): Promise<void> {
  await getRepository(id);
  // Members and stats cascade; deliveries keep their denormalized repo name so
  // the log stays readable after the repository is gone.
  await prisma.repository.delete({ where: { id } });
}
