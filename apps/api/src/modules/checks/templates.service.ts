/**
 * Shared check templates: one set of limits, inherited by many fronts.
 *
 * A front keeps its own overrides regardless, so switching or losing a template
 * never silently rewrites what a front asked for — the layers are resolved on
 * read (`resolveChecks`), never flattened into storage.
 */

import type { CheckTemplate, CheckTemplateInput, PartialCheckMap } from "@commander/shared";
import { checkMapSchema } from "@commander/shared";
import type { CheckTemplate as StoredTemplate } from "@prisma/client";
import { prisma } from "@/db/prisma.js";
import { ConflictError, NotFoundError } from "@/core/errors/app-error.js";
import { toJson } from "@/core/json.js";

/**
 * Validated on read, never trusted. A document written by an older shape must
 * fail here and fall back to nothing, rather than reach the judgement as a
 * threshold of `undefined` — which compares false against every number and stops
 * the check reporting without stopping it running.
 */
export function readCheckMap(stored: unknown): PartialCheckMap {
  // Straight into zod rather than through `fromJson`: the JSON boundary exists
  // to narrow what cannot be checked, and this can be. Parsing *is* the cast.
  const parsed = checkMapSchema.safeParse(stored);
  return parsed.success ? parsed.data : {};
}

function toDto(row: StoredTemplate & { _count?: { repositories: number } }): CheckTemplate {
  return {
    id: row.id,
    name: row.name,
    checks: readCheckMap(row.checks),
    repositoryCount: row._count?.repositories ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTemplates(): Promise<CheckTemplate[]> {
  const rows = await prisma.checkTemplate.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { repositories: true } } },
  });
  return rows.map(toDto);
}

export async function createTemplate(input: CheckTemplateInput): Promise<CheckTemplate> {
  await assertNameFree(input.name, null);

  const row = await prisma.checkTemplate.create({
    data: { name: input.name, checks: toJson(input.checks) },
  });
  return toDto(row);
}

export async function updateTemplate(
  id: string,
  input: CheckTemplateInput,
): Promise<CheckTemplate> {
  await assertNameFree(input.name, id);

  const row = await prisma.checkTemplate
    .update({
      where: { id },
      data: { name: input.name, checks: toJson(input.checks) },
      include: { _count: { select: { repositories: true } } },
    })
    .catch(() => {
      throw new NotFoundError("checks.templateNotFound");
    });

  return toDto(row);
}

/**
 * Deleting a template loosens every front that inherited it back to the shipped
 * defaults — which the schema does with `SetNull` rather than a cascade, because
 * losing a set of limits must never delete the fronts judged by them.
 */
export async function deleteTemplate(id: string): Promise<void> {
  await prisma.checkTemplate.delete({ where: { id } }).catch(() => {
    throw new NotFoundError("checks.templateNotFound");
  });
}

async function assertNameFree(name: string, exceptId: string | null): Promise<void> {
  const existing = await prisma.checkTemplate.findUnique({ where: { name } });
  if (existing && existing.id !== exceptId) throw new ConflictError("checks.templateDuplicate");
}
