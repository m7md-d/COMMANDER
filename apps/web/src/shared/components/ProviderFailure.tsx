import { useTranslate } from "@/shared/i18n/I18nProvider";

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
 * What the provider said when it refused — each field under its own heading,
 * its value exactly as it arrived. Nothing here rewords it or suggests what to
 * do: the operator reads the provider's words and decides.
 */
export function ProviderFailure({ detail }: { detail: Record<string, string | number> }) {
  const t = useTranslate();

  return (
    <dl className="dispatch-failure">
      {FIELDS.filter((field) => detail[field] !== undefined).map((field) => (
        <div key={field} className="dispatch-failure-row">
          <dt>{t(`failure.${field}`)}</dt>
          <dd className="ltr mono">{String(detail[field])}</dd>
        </div>
      ))}
    </dl>
  );
}
