import { z } from "zod";
import { DELIVERY_STATUSES } from "../domain/delivery.js";
import type { DeliveryReason, DeliveryStatus } from "../domain/delivery.js";

/**
 * Which shelf to read. `active` is the default so the main view never shows
 * archived dispatches without asking — archiving is how the list is kept from
 * burying the operator.
 */
export const DELIVERY_SCOPES = ["active", "archived"] as const;
export type DeliveryScope = (typeof DELIVERY_SCOPES)[number];

export const deliveryQuerySchema = z.object({
  status: z.enum(DELIVERY_STATUSES).optional(),
  repositoryId: z.string().optional(),
  scope: z.enum(DELIVERY_SCOPES).default("active"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export type DeliveryQuery = z.infer<typeof deliveryQuerySchema>;

/**
 * Bulk archive matches whatever the active list is showing — the same optional
 * filters — so "archive all" always means "archive exactly what I am looking at".
 */
export const deliveryArchiveSchema = z.object({
  status: z.enum(DELIVERY_STATUSES).optional(),
  repositoryId: z.string().optional(),
});

export type DeliveryArchive = z.infer<typeof deliveryArchiveSchema>;

export interface Delivery {
  id: string;
  repositoryId: string | null;
  repositoryFullName: string;
  branch: string;
  actorLogin: string;
  commitCount: number;
  violationCount: number;
  status: DeliveryStatus;
  reason: DeliveryReason;
  /** Interpolated into the localized reason, e.g. `{ status: 429 }`. */
  reasonDetail: Record<string, string | number>;
  attempts: number;
  nextAttemptAt: string | null;
  reportText: string | null;
  model: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  /** Null while active; a timestamp once moved to the archive shelf. */
  archivedAt: string | null;
}

export interface DeliveryPage {
  items: Delivery[];
  nextCursor: string | null;
}

/** Result of a bulk archive or a purge: how many rows the action touched. */
export interface DeliveryBulkResult {
  count: number;
}

export interface MemberStat {
  login: string;
  displayName: string;
  rank: string;
  totalCommits: number;
  totalPushes: number;
  violationCounts: Record<string, number>;
  violationTotal: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface OverviewStats {
  repositoryCount: number;
  memberCount: number;
  pushCount: number;
  violationCount: number;
  pendingDeliveries: number;
  failedDeliveries: number;
}
