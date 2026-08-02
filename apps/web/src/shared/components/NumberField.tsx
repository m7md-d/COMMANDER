import { useTranslate } from "@/shared/i18n/I18nProvider";

interface NumberFieldProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}

/**
 * A compact stepper: [−] value [+]. Replaces the native `type="number"`, whose
 * full-width box and OS spinner arrows read as an afterthought (the "dumb, long"
 * field). Here the value sits in mono between two keys, sized to its content.
 *
 * The centre stays a real text input so a large jump can be typed rather than
 * clicked forty times; the keys clamp to [min, max] and round to the step's
 * precision so 0.1 increments do not drift into 0.30000000000000004.
 */
export function NumberField({ id, value, onChange, min, max, step = 1 }: NumberFieldProps) {
  const t = useTranslate();

  const decimals = (String(step).split(".")[1] ?? "").length;
  const commit = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    onChange(Number(clamped.toFixed(decimals)));
  };

  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper-key"
        aria-label={t("action.decrement")}
        disabled={value <= min}
        onClick={() => commit(value - step)}
      >
        −
      </button>
      <input
        id={id}
        className="stepper-value ltr"
        inputMode="decimal"
        value={String(value)}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
        onBlur={() => commit(value)}
      />
      <button
        type="button"
        className="stepper-key"
        aria-label={t("action.increment")}
        disabled={value >= max}
        onClick={() => commit(value + step)}
      >
        +
      </button>
    </div>
  );
}
