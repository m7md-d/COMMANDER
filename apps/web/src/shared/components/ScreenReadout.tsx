import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Button } from "./Button";

export interface ReadoutRow {
  /** Stable identity for the row. */
  key: string;
  label: string;
  /** `null` renders as a phosphor placeholder rather than a zero. */
  value: number | null;
}

interface ScreenReadoutProps {
  pending: boolean;
  error: unknown;
  onRetry?: () => void;
  rows: ReadoutRow[];
}

/**
 * A phosphor label/value table for the inside of a CrtScreen.
 *
 * It owns its own loading and error states rather than being wrapped in
 * QueryState, because the generic states render olive skeletons that would
 * clash inside a green tube. On a screen, "no signal" IS the loading state, so
 * it is drawn in the screen's own language.
 */
export function ScreenReadout({ pending, error, onRetry, rows }: ScreenReadoutProps) {
  const t = useTranslate();

  if (pending) {
    return <p className="screen-line screen-blink">{`> ${t("screen.linking")}`}</p>;
  }

  if (error) {
    return (
      <div className="screen-stack">
        <p className="screen-line screen-alarm">{`> ${t("screen.lost")}`}</p>
        {onRetry ? (
          <Button size="sm" onClick={onRetry}>
            {t("action.retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <dl className="readout">
      {rows.map((row) => (
        <div className="readout-row" key={row.key}>
          <dt className="readout-label">{row.label}</dt>
          <dd className="readout-dots" aria-hidden="true" />
          <dd className="readout-value">
            {row.value === null ? "––" : String(row.value).padStart(3, "0")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
