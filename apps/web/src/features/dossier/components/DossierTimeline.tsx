import type { DossierEvent } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatDateTime } from "@/shared/lib/format";
import { Badge } from "@/shared/components/Badge";
import { Card } from "@/shared/components/Card";
import { DataTable, type Column } from "@/shared/components/DataTable";

type TimelineRow = DossierEvent & { id: string };

/**
 * Every recorded occurrence, newest first, with the weight it currently carries
 * rather than the weight it had when it happened — that difference is the whole
 * point of the decay model, so it has to be visible.
 */
export function DossierTimeline({ events }: { events: DossierEvent[] }) {
  const t = useTranslate();

  // The ledger has no per-event id in the contract, and one push can produce two
  // events of the same rule at the same instant — so position completes the key.
  const rows: TimelineRow[] = [...events]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((event, index) => ({ ...event, id: `${event.ruleId}-${event.occurredAt}-${index}` }));

  const columns: Column<TimelineRow>[] = [
    {
      key: "rule",
      header: t("dossier.timeline"),
      render: (event) => (
        <span className="row row-bottom">
          <span>{t(`rule.${event.ruleId}.label`)}</span>
          {event.anomaly ? <Badge tone="info">{t("dossier.anomalyBadge")}</Badge> : null}
        </span>
      ),
    },
    {
      key: "occurredAt",
      header: t("dossier.lastTouched"),
      render: (event) => formatDateTime(event.occurredAt, "—"),
    },
    {
      key: "weight",
      header: t("dossier.weight"),
      render: (event) => event.weight.toFixed(2),
    },
  ];

  return (
    <Card title={t("dossier.timeline")}>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(event) => event.id}
        emptyMessage={t("dossier.empty")}
      />
    </Card>
  );
}
