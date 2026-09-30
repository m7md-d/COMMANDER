import { useTranslate } from "@/shared/i18n/I18nProvider";
import { ChipInput } from "@/shared/components/ChipInput";
import { Field, labelOf } from "@/shared/components/Field";

interface PatternFieldProps {
  label: string;
  /** How many patterns the layer beneath holds, shown so a blank layer reads as inherited. */
  inherited: number;
  values: string[];
  onChange: (next: string[]) => void;
}

/** A check's include or exclude patterns, as removable chips. */
export function PatternField({ label, inherited, values, onChange }: PatternFieldProps) {
  const t = useTranslate();

  return (
    <Field label={label} hint={t("checks.inherited", { value: inherited })}>
      {(id) => (
        <ChipInput
          labelledBy={labelOf(id)}
          values={values}
          onChange={onChange}
          addLabel={t("checks.patternAdd")}
          removeLabel={t("checks.patternRemove")}
        />
      )}
    </Field>
  );
}
