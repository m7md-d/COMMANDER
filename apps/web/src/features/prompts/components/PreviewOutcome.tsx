import type { PreviewResult } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Badge } from "@/shared/components/Badge";
import { ProviderFailure } from "@/shared/components/ProviderFailure";

/**
 * What the preview produced, and — when the model did not write it — why, in
 * the server's own words: its error code, and the provider's refusal field by
 * field. A badge alone said "the model call failed" when the key was missing
 * (W-07); the operator reads the cause and decides, nothing here suggests.
 */
export function PreviewOutcome({ result }: { result: PreviewResult }) {
  const t = useTranslate();

  return (
    <div className="stack">
      {!result.llmOk ? (
        <>
          <Badge tone="danger">{t("delivery.reason.llm_failed")}</Badge>
          {result.llmError ? <p className="dispatch-error ltr mono">{result.llmError}</p> : null}
          {result.llmFailure ? <ProviderFailure detail={result.llmFailure} /> : null}
        </>
      ) : null}
      <div className="report-block">{result.reportText}</div>
    </div>
  );
}
