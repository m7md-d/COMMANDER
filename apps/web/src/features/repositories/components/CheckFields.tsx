import {
  CHECK_METRICS,
  type CheckMetric,
  type PartialCheckConfig,
  type PartialCheckMap,
} from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { ChipInput } from "@/shared/components/ChipInput";
import { Field } from "@/shared/components/Field";
import { NumberField } from "@/shared/components/NumberField";
import { Toggle } from "@/shared/components/Toggle";

interface CheckFieldsProps {
  value: PartialCheckMap;
  onChange: (next: PartialCheckMap) => void;
  /** What each field falls back to when this layer says nothing — the template's
   *  value on a front, the shipped defaults on a template. Shown, not merged: a
   *  blank field has to look inherited rather than empty. */
  inherited: Record<CheckMetric, Required<PartialCheckConfig>>;
}

const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 100_000;

/**
 * One editor for both places a check limit is set: a front's overrides and a
 * shared template.
 *
 * The same component in both is not a saving, it is the point — the two edit the
 * same document at different layers, and two editors would drift into disagreeing
 * about what a field means.
 */
export function CheckFields({ value, onChange, inherited }: CheckFieldsProps) {
  const t = useTranslate();

  const patch = (metric: CheckMetric, next: PartialCheckConfig) =>
    onChange({ ...value, [metric]: { ...value[metric], ...next } });

  return (
    <div className="stack">
      {CHECK_METRICS.map((metric) => {
        const layer = value[metric] ?? {};
        const base = inherited[metric];
        const enabled = layer.enabled ?? base.enabled;

        return (
          <article key={metric} className={`clause ${enabled ? "clause-live" : ""}`}>
            <Toggle
              label={t(`rule.${metric}.label`)}
              checked={enabled}
              onChange={(next) => patch(metric, { enabled: next })}
            />
            <p className="hint clause-note">{t(`rule.${metric}.hint`)}</p>

            {enabled ? (
              <div className="clause-terms stack">
                <Field
                  label={t("checks.threshold")}
                  hint={t("checks.inherited", { value: base.threshold })}
                >
                  {(id) => (
                    <NumberField
                      id={id}
                      value={layer.threshold ?? base.threshold}
                      onChange={(threshold) => patch(metric, { threshold })}
                      min={MIN_THRESHOLD}
                      max={MAX_THRESHOLD}
                    />
                  )}
                </Field>

                <Field
                  label={t("checks.include")}
                  hint={t("checks.inherited", { value: base.include.length })}
                >
                  {() => (
                    <ChipInput
                      values={layer.include ?? base.include}
                      onChange={(include) => patch(metric, { include })}
                      addLabel={t("checks.patternAdd")}
                      removeLabel={t("checks.patternRemove")}
                    />
                  )}
                </Field>

                <Field
                  label={t("checks.exclude")}
                  hint={t("checks.inherited", { value: base.exclude.length })}
                >
                  {() => (
                    <ChipInput
                      values={layer.exclude ?? base.exclude}
                      onChange={(exclude) => patch(metric, { exclude })}
                      addLabel={t("checks.patternAdd")}
                      removeLabel={t("checks.patternRemove")}
                    />
                  )}
                </Field>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
