import type { Prompt as PrismaPrompt } from "@prisma/client";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_TEMPLATE,
  type Prompt,
  type PromptInput,
} from "@commander/shared";
import { ConflictError, NotFoundError } from "@/core/errors/app-error.js";
import { createLogger } from "@/core/logger/logger.js";
import { prisma } from "@/db/prisma.js";

const log = createLogger("prompts");

function toDto(row: PrismaPrompt): Prompt {
  return {
    id: row.id,
    name: row.name,
    system: row.system,
    user: row.user,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPrompts(): Promise<Prompt[]> {
  const rows = await prisma.prompt.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return rows.map(toDto);
}

export async function getPrompt(id: string): Promise<Prompt> {
  const row = await prisma.prompt.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("prompt.notFound");
  return toDto(row);
}

/** Used when a repository has no prompt of its own. */
export async function getDefaultPrompt(): Promise<Prompt> {
  const row = await prisma.prompt.findFirst({ where: { isDefault: true } });
  if (row) return toDto(row);

  const first = await prisma.prompt.findFirst({ orderBy: { createdAt: "asc" } });
  if (!first) throw new NotFoundError("prompt.notFound");
  return toDto(first);
}

export async function createPrompt(input: PromptInput): Promise<Prompt> {
  const row = await prisma.prompt.create({ data: { ...input, isDefault: false } });
  return toDto(row);
}

export async function updatePrompt(id: string, input: PromptInput): Promise<Prompt> {
  await getPrompt(id);
  const row = await prisma.prompt.update({ where: { id }, data: input });
  return toDto(row);
}

/**
 * The default prompt is undeletable: repositories fall back to it, so removing
 * it would leave them pointing at nothing at delivery time — the worst possible
 * moment to discover a broken reference.
 */
export async function deletePrompt(id: string): Promise<void> {
  const prompt = await getPrompt(id);
  if (prompt.isDefault) throw new ConflictError("prompt.lastOne");

  const total = await prisma.prompt.count();
  if (total <= 1) throw new ConflictError("prompt.lastOne");

  // Repository.promptId is ON DELETE SET NULL, so dependants degrade to the
  // default rather than breaking.
  await prisma.prompt.delete({ where: { id } });
}

/** Seeds the shipped persona on first boot. Idempotent. */
export async function ensureDefaultPrompt(): Promise<Prompt> {
  const existing = await prisma.prompt.findFirst({ where: { isDefault: true } });
  if (existing) return toDto(existing);

  const row = await prisma.prompt.create({
    data: {
      name: "القائد العام",
      system: DEFAULT_SYSTEM_PROMPT,
      user: DEFAULT_USER_TEMPLATE,
      isDefault: true,
    },
  });

  log.info("seeded default prompt");
  return toDto(row);
}
