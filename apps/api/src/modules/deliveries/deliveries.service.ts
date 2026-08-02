import type { Delivery as PrismaDelivery, Prisma } from "@prisma/client";
import type {
  Delivery,
  DeliveryArchive,
  DeliveryPage,
  DeliveryQuery,
  DeliveryReason,
} from "@commander/shared";
import { NotFoundError } from "@/core/errors/app-error.js";
import { prisma } from "@/db/prisma.js";
import { requeue } from "@/queue/outbox.service.js";

function toDto(row: PrismaDelivery): Delivery {
  return {
    id: row.id,
    repositoryId: row.repositoryId,
    repositoryFullName: row.repositoryFullName,
    branch: row.branch,
    actorLogin: row.actorLogin,
    commitCount: row.commitCount,
    violationCount: row.violationCount,
    status: row.status,
    reason: row.reason as DeliveryReason,
    reasonDetail: (row.reasonDetail ?? {}) as Record<string, string | number>,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    reportText: row.reportText,
    model: row.model,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

/**
 * Cursor pagination on id, not offset: the list grows at the head, and OFFSET
 * would silently skip rows as new deliveries arrive between pages.
 */
export async function listDeliveries(query: DeliveryQuery): Promise<DeliveryPage> {
  const where: Prisma.DeliveryWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.repositoryId && { repositoryId: query.repositoryId }),
    // The scope is always applied: the active view must never surface archived
    // rows, and the archive view shows only them.
    archivedAt: query.scope === "archived" ? { not: null } : null,
  };

  const rows = await prisma.delivery.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
  });

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    items: items.map(toDto),
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

export async function getDelivery(id: string): Promise<Delivery> {
  const row = await prisma.delivery.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("delivery.notFound");
  return toDto(row);
}

/** Re-queues a terminal delivery. Only failures are eligible. */
export async function retryDelivery(id: string): Promise<Delivery> {
  const existing = await getDelivery(id);
  if (existing.status !== "failed") throw new NotFoundError("delivery.notRetryable");

  await requeue(id);
  return getDelivery(id);
}

/** Moves one dispatch to the archive (idempotent — re-archiving is a no-op). */
export async function archiveDelivery(id: string): Promise<Delivery> {
  await getDelivery(id);
  await prisma.delivery.update({ where: { id }, data: { archivedAt: new Date() } });
  return getDelivery(id);
}

/** Brings one dispatch back to the active shelf. */
export async function restoreDelivery(id: string): Promise<Delivery> {
  await getDelivery(id);
  await prisma.delivery.update({ where: { id }, data: { archivedAt: null } });
  return getDelivery(id);
}

/**
 * Archives every active dispatch matching the given filters — the same filters
 * the active list uses, so this archives exactly what the operator is looking
 * at. Only rows not already archived are touched.
 */
export async function archiveMatching(filter: DeliveryArchive): Promise<number> {
  const { count } = await prisma.delivery.updateMany({
    where: {
      archivedAt: null,
      ...(filter.status && { status: filter.status }),
      ...(filter.repositoryId && { repositoryId: filter.repositoryId }),
    },
    data: { archivedAt: new Date() },
  });
  return count;
}

/**
 * Permanently deletes the archive. This is the action that actually frees the
 * space — archiving only hides — so it is deliberately all-or-nothing and lives
 * behind a confirmation on the client.
 */
export async function purgeArchived(): Promise<number> {
  const { count } = await prisma.delivery.deleteMany({ where: { archivedAt: { not: null } } });
  return count;
}
