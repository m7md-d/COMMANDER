import type { RuleConfig, RuleId } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Field } from "@/shared/components/Field";
import { Input } from "@/shared/components/Input";
import { parseCommaList } from "@/shared/lib/format";

interface RuleFieldsProps {
  ruleId: RuleId;
  config: RuleConfig;
  onPatch: (patch: Record<string, unknown>) => void;
}

/**
 * Which rules have settings beyond on/off. Kept beside the switch below and not
 * derived from it, because a caller has to know *before* rendering whether to
 * draw the sub-clause frame — a frame around a null child is an empty box.
 * Adding a case below without adding it here shows up immediately as settings
 * that never appear.
 */
const RULES_WITH_TERMS = new Set<RuleId>([
  "batch_dump",
  "large_diff",
  "night_ops",
  "lazy_message",
  "weekend_ops",
]);

export function hasRuleTerms(ruleId: RuleId): boolean {
  return RULES_WITH_TERMS.has(ruleId);
}

/**
 * Rule configs have different shapes, so the extra inputs are chosen per rule.
 * The cast reads a field the union does not guarantee — safe because the switch
 * has already established which variant this is.
 */
export function RuleFields({ ruleId, config, onPatch }: RuleFieldsProps) {
  const t = useTranslate();
  const read = config as Record<string, unknown>;
  const num = (key: string) => Number(read[key] ?? 0);

  const numberField = (field: { labelKey: string; key: string; min: number; max: number }) => (
    <Field label={t(field.labelKey)}>
      {(id) => (
        <Input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          value={num(field.key)}
          onChange={(event) => onPatch({ [field.key]: Number(event.target.value) })}
        />
      )}
    </Field>
  );

  switch (ruleId) {
    case "batch_dump":
    case "large_diff":
      return <div className="grid grid-3">{numberField({ labelKey: "rules.threshold", key: "threshold", min: 1, max: 10_000 })}</div>;

    case "night_ops":
      return (
        <div className="grid grid-3">
          {numberField({ labelKey: "rules.startHour", key: "startHour", min: 0, max: 23 })}
          {numberField({ labelKey: "rules.endHour", key: "endHour", min: 0, max: 23 })}
        </div>
      );

    case "lazy_message":
      return (
        <div className="grid grid-2">
          {numberField({ labelKey: "rules.minLength", key: "minLength", min: 1, max: 200 })}
          <Field label={t("rules.words")} hint={t("rules.wordsHint")}>
            {(id) => (
              <Input
                id={id}
                ltr
                value={(read.words as string[] | undefined)?.join(", ") ?? ""}
                onChange={(event) => onPatch({ words: parseCommaList(event.target.value) })}
              />
            )}
          </Field>
        </div>
      );

    case "weekend_ops": {
      const days = (read.days as number[] | undefined) ?? [];
      return (
        <Field label={t("rules.days")}>
          {() => (
            <div className="chip-list">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <label className="chip" key={day}>
                  <input
                    type="checkbox"
                    checked={days.includes(day)}
                    onChange={(event) =>
                      onPatch({
                        days: event.target.checked
                          ? [...days, day].sort()
                          : days.filter((value) => value !== day),
                      })
                    }
                  />
                  {t(`day.${day}`)}
                </label>
              ))}
            </div>
          )}
        </Field>
      );
    }

    default:
      return null;
  }
}
