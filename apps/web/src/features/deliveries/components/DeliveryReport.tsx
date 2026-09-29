import type { Delivery, DeliveryFinding } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { DeliveryPrompts } from "./DeliveryPrompts";
import { ProviderFailure } from "@/shared/components/ProviderFailure";

interface DeliveryReportProps {
  delivery: Delivery;
}

/**
 * What a dispatch was about (0012): the event, who answers for each charge and
 * credit, the report the team was told, and — folded away — what the model was
 * given. A row from before 0012 kept no judgement and shows its report alone.
 */
export function DeliveryReport({ delivery }: DeliveryReportProps) {
  const t = useTranslate();
  const { judgement } = delivery;

  return (
    <div className="dispatch-report">
      {delivery.resendOf ? <span className="dispatch-tag">{t("dispatch.rewriteOf")}</span> : null}
      {judgement ? (
        <>
          <p className="dispatch-event">
            {t(`dispatch.event.${judgement.event.kind}`)}
            {judgement.event.pull !== null ? ` #${judgement.event.pull}` : ""}
            {judgement.mainLine ? ` · ${t("dispatch.mainLine")}` : ""}
          </p>
          <Findings title={t("dispatch.charges")} entries={judgement.charges} />
          <Findings title={t("dispatch.credits")} entries={judgement.credits} />
        </>
      ) : null}
      {"provider" in delivery.reasonDetail ? (
        <ProviderFailure detail={delivery.reasonDetail} />
      ) : delivery.status === "failed" && delivery.errorMessage ? (
        <p className="dispatch-error ltr mono">{delivery.errorMessage}</p>
      ) : null}
      {delivery.reportText ? (
        <details className="dispatch-fold">
          <summary>{t("dispatch.report")}</summary>
          <p className="dispatch-text">{delivery.reportText}</p>
        </details>
      ) : null}
      <DeliveryPrompts id={delivery.id} model={delivery.model} />
    </div>
  );
}

function Findings({ title, entries }: { title: string; entries: DeliveryFinding[] }) {
  const t = useTranslate();
  if (entries.length === 0) return null;

  return (
    <p className="dispatch-findings">
      <span className="dispatch-tag">{title}</span>
      {entries.map((entry, index) => (
        <span key={`${entry.ruleId}-${entry.login}-${index}`} className="dispatch-finding">
          {t(`rule.${entry.ruleId}.label`)}
          {` ${t("dispatch.chargedTo")} `}
          <span className="ltr mono">{entry.login}</span>
        </span>
      ))}
    </p>
  );
}
