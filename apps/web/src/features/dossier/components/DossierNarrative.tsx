import type { MemberDossier } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatDateTime } from "@/shared/lib/format";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";

interface DossierNarrativeProps {
  dossier: MemberDossier;
  onRegenerate: () => void;
  regenerating: boolean;
}

/**
 * The written record. It is regenerated only when the facts fingerprint moves,
 * so the button exists for the other case: the prompt changed but the numbers
 * did not, and the operator wants the prose rewritten anyway.
 */
export function DossierNarrative({ dossier, onRegenerate, regenerating }: DossierNarrativeProps) {
  const t = useTranslate();

  return (
    <Card
      title={t("dossier.narrative")}
      hint={
        dossier.narrativeUpdatedAt
          ? `${t("dossier.narrativeUpdated")}: ${formatDateTime(dossier.narrativeUpdatedAt, "—")}`
          : undefined
      }
      actions={
        <Button size="sm" loading={regenerating} onClick={onRegenerate}>
          {t("dossier.regenerate")}
        </Button>
      }
    >
      {dossier.narrative ? (
        <p className="report-block">{dossier.narrative}</p>
      ) : (
        <EmptyState message={t("dossier.noNarrative")} />
      )}
    </Card>
  );
}
