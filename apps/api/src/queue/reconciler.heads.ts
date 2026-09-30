/**
 * The head each branch had when a pass last read it (`reconciled_heads`).
 * Which branches to read given these is `branchesToReconcile`'s decision; this
 * only keeps them.
 */

import { prisma } from "@/db/prisma.js";

export async function loadLastRead(repositoryId: string): Promise<Map<string, string>> {
  const rows = await prisma.reconciledHead.findMany({
    where: { repositoryId },
    select: { branch: true, sha: true },
  });
  return new Map(rows.map((row) => [row.branch, row.sha]));
}

/** Called once a branch was read: a failed read leaves it to be asked again. */
export async function rememberRead(input: { repositoryId: string; branch: string; sha: string }): Promise<void> {
  const { repositoryId, branch, sha } = input;
  await prisma.reconciledHead.upsert({
    where: { repositoryId_branch: { repositoryId, branch } },
    create: { repositoryId, branch, sha },
    update: { sha },
  });
}

/** Branches deleted since: a branch cut again under the same name is read afresh. */
export async function forgetGone(repositoryId: string, existing: ReadonlyMap<string, string>): Promise<void> {
  await prisma.reconciledHead.deleteMany({
    where: { repositoryId, branch: { notIn: [...existing.keys()] } },
  });
}
