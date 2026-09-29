import type { Delivery, DeliveryStatus, OverviewStats } from "@commander/shared";
import type { ReadoutRow } from "@/shared/components/ScreenReadout";
import type { TapeLine } from "@/shared/components/TelegraphTape";

/**
 * View-model mappers for the headquarters screens. Pure: data in, rows out.
 *
 * They live here rather than in the page because the page must stay composition
 * only (frontend constitution §5), and they take *already-fetched* data as
 * arguments — they import no feature hooks, so the command post never reaches
 * sideways into features/stats or features/deliveries.
 */

type Translate = (key: string) => string;

/** The four figures the situation screen reports, in reading order. */
export function toReadout(stats: OverviewStats | undefined, t: Translate): ReadoutRow[] {
  return [
    { key: "repositories", label: t("nav.repositories"), value: stats?.repositoryCount ?? null },
    { key: "members", label: t("nav.members"), value: stats?.memberCount ?? null },
    { key: "violations", label: t("dossier.totalViolations"), value: stats?.violationCount ?? null },
    // What waits in the queue, named as the operations room names it. Under the
    // dispatches page's name it read "dispatches 000" beside six on record (W-02).
    { key: "pending", label: t("overview.pendingDeliveries"), value: stats?.pendingDeliveries ?? null },
  ];
}

const TONE: Record<DeliveryStatus, TapeLine["tone"]> = {
  sent: "sent",
  failed: "failed",
  pending: "pending",
  processing: "pending",
  skipped: "muted",
};

const TAPE_LIMIT = 7;

/** The latest dispatches as tape lines, newest first, assembled LTR. */
export function toTape(items: Delivery[]): TapeLine[] {
  return items.slice(0, TAPE_LIMIT).map((delivery) => ({
    key: delivery.id,
    text: `${delivery.repositoryFullName} · ${delivery.actorLogin || "—"}`,
    tone: TONE[delivery.status],
  }));
}

/**
 * The screen's retry, or none. The public headquarters asks for data a visitor
 * is not allowed to read: a 401 answers the same every time, so a retry beside
 * it could never change anything (docs/UI-DEFECTS.md W-17). Anything else — a
 * network blip, a restart — may pass.
 */
export function retryFor(error: unknown, refetch: () => void): (() => void) | undefined {
  const unauthorized = typeof error === "object" && error !== null && "status" in error && error.status === 401;
  return unauthorized ? undefined : refetch;
}
