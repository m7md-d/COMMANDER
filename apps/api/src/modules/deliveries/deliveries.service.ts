import type { Delivery as PrismaDelivery, Prisma } from "@prisma/client";
import {
  resendKind,
  type Delivery,
  type DeliveryArchive,
  type DeliveryDetail,
  type DeliveryPage,
  type DeliveryQuery,
  type DeliveryReason,
} from "@commander/shared";
import { NotFoundError } from "@/core/errors/app-error.js";
import { prisma } from "@/db/prisma.js";
import { requeue } from "@/queue/outbox.service.js";
import { judgementOf, readKeptReport } from "@/queue/report.kept.js";
import { enqueueRewrite } from "@/queue/report.record.js";

/** A row as the list reads it: what the model was given stays out of a page of sixty. */
type Listed = Omit<PrismaDelivery, "systemPrompt" | "userPrompt" | "embed">;
const LISTED = { systemPrompt: true, userPrompt: true, embed: true } as const;

function toDto(row: Listed): Delivery {
  const kept = readKeptReport(row.judgement);
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
    judgement: kept ? judgementOf(kept) : null,
    resend: resendKind({ status: row.status, judged: kept !== null }),
    resendOf: row.resendOf,
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
    omit: LISTED,
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

/** One row, with what the model was given — read when its details are opened. */
export async function getDelivery(id: string): Promise<DeliveryDetail> {
  const row = await prisma.delivery.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("delivery.notFound");
  return { ...toDto(row), systemPrompt: row.systemPrompt, userPrompt: row.userPrompt };
}

/**
 * The resend button (0012), from the judgement the row kept — never judging
 * again, which records the push twice (D-31). A row that never reached Discord
 * is queued again for its first report; one that did gets a new row, a rewrite
 * pointing at it, so the log keeps what the team was told the first time.
 */
export async function resendDelivery(id: string): Promise<Delivery> {
  const row = await prisma.delivery.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("delivery.notFound");
  const kept = readKeptReport(row.judgement);
  const kind = resendKind({ status: row.status, judged: kept !== null });
  if (kind === null || kept === null) throw new NotFoundError("delivery.notResendable");

  if (kind === "rewrite") return toDto(await enqueueRewrite(row, kept));
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
