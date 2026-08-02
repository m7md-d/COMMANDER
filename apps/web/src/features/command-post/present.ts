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
    { key: "pending", label: t("nav.deliveries"), value: stats?.pendingDeliveries ?? null },
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
