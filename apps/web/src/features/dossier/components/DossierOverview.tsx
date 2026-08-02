import type { MemberDossier } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatDateTime } from "@/shared/lib/format";
import { Badge } from "@/shared/components/Badge";
import { Card } from "@/shared/components/Card";
import { StatTile } from "@/shared/components/StatTile";
import { roundScore, tierTone } from "../tier";

/**
 * The numbers, and only the numbers. The narrative next door describes these —
 * it never introduces a figure that is not shown here first.
 */
export function DossierOverview({ dossier }: { dossier: MemberDossier }) {
  const t = useTranslate();

  return (
    <Card
      title={dossier.displayName || dossier.login}
      hint={t("dossier.decayHint")}
      actions={<Badge tone={tierTone(dossier.tier)}>{t(`tier.${dossier.tier}`)}</Badge>}
    >
      <div className="stack">
        <div className="grid grid-stats">
          <StatTile value={roundScore(dossier.riskScore)} label={t("dossier.riskScore")} />
          <StatTile value={dossier.totalViolations} label={t("dossier.totalViolations")} />
          {/* Beside the charge, not netted against it. A record that showed one
              number for both would be arithmetic, and this is not arithmetic. */}
          <StatTile value={dossier.totalCommendations} label={t("dossier.totalCommendations")} />
          <StatTile value={dossier.cleanStreakDays} label={t("dossier.cleanStreak")} />
          <StatTile value={dossier.anomalyCount} label={t("dossier.anomalies")} />
        </div>

        {dossier.enriched ? null : <p className="hint">{t("dossier.notEnriched")}</p>}

        <p className="hint">
          {t("dossier.computedAt")}: {formatDateTime(dossier.computedAt, "—")}
        </p>
      </div>
    </Card>
  );
}
