import { useState } from "react";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useSettings } from "@/shared/hooks/useSettings";
import { failureSummary } from "@/shared/lib/failureSummary";
import { formatDateTime } from "@/shared/lib/format";
import { Button } from "./Button";

/** The fields a row keeps of a provider's refusal (`failureDetail`), in reading order. */
const FIELDS = [
  "provider",
  "status",
  "code",
  "message",
  "upstream",
  "detail",
  "retryAfterSeconds",
  "quotaLimit",
  "quotaRemaining",
  "quotaReset",
] as const;

/**
 * A provider's refusal: what happened, as sentences a person reads — how long
 * it asked to wait, when its quota renews, in the reader's own clock. Under
 * them, when the operator has turned `rawFailures` on, a button shows the
 * provider's reply field by field, exactly as it arrived. Nothing here says
 * what to do about it: the operator decides.
 */
export function ProviderFailure({ detail }: { detail: Record<string, string | number> }) {
  const t = useTranslate();
  const settings = useSettings();
  const [shown, setShown] = useState(false);
  const allowed = settings.data?.rawFailures === true;
  const provider = t(`failure.name.${String(detail["provider"] ?? "")}`);

  return (
    <div className="dispatch-failure-card">
      {failureSummary(detail).map((line) => (
        <p key={line.key} className="dispatch-failure-line">
          {t(line.key, { ...line.vars, provider, time: line.at ? formatDateTime(line.at, "") : "" })}
        </p>
      ))}
      {allowed ? (
        <Button variant="ghost" size="sm" aria-expanded={shown} onClick={() => setShown((open) => !open)}>
          {t(shown ? "failure.hideRaw" : "failure.showRaw")}
        </Button>
      ) : null}
      {allowed && shown ? (
        <dl className="dispatch-failure">
          {FIELDS.filter((field) => detail[field] !== undefined).map((field) => (
            <div key={field} className="dispatch-failure-row">
              <dt>{t(`failure.${field}`)}</dt>
              <dd className="ltr mono">{String(detail[field])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
