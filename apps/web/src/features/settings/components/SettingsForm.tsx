import { LOCALES, type LocaleId, type SecretStatus, type Settings } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Card } from "@/shared/components/Card";
import { SecretBadges } from "@/features/settings/components/SecretBadges";
import { Field } from "@/shared/components/Field";
import { NumberField } from "@/shared/components/NumberField";
import { ModelPicker } from "@/shared/components/model-picker/ModelPicker";
import { Select } from "@/shared/components/Select";
import { Toggle } from "@/shared/components/Toggle";

interface SettingsFormProps {
  value: Settings;
  patch: <K extends keyof Settings>(key: K, next: Settings[K]) => void;
  secrets: Partial<SecretStatus>;
}

/**
 * Every knob, grouped. Split out of the page on 2026-07-27 because the page had
 * become the form (apps/web/CONSTITUTION.md §5: `pages/` compose only) — the
 * page now owns the draft and the save bar, and this owns what a setting looks
 * like.
 */
export function SettingsForm({ value, patch, secrets }: SettingsFormProps) {
  const t = useTranslate();
  const localeOptions = LOCALES.map((entry) => ({ value: entry.id, label: entry.name }));

  const numberField = (field: {
    labelKey: string;
    key: keyof Settings;
    min: number;
    max: number;
    step?: number;
    hintKey?: string;
  }) => (
    <Field label={t(field.labelKey)} hint={field.hintKey ? t(field.hintKey) : undefined}>
      {(id) => (
        <NumberField
          id={id}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={value[field.key] as number}
          onChange={(next) => patch(field.key, next as Settings[typeof field.key])}
        />
      )}
    </Field>
  );

  return (
    <div className="stack">
      <Card title={t("settings.sectionAppearance")}>
        <div className="grid grid-2">
          <Field label={t("settings.reportLocale")} hint={t("settings.reportLocaleHint")}>
            {(id) => (
              <Select
                id={id}
                value={value.reportLocale}
                onValueChange={(v) => patch("reportLocale", v as LocaleId)}
                options={localeOptions}
              />
            )}
          </Field>
          {numberField({
            labelKey: "settings.timezoneOffset",
            key: "timezoneOffset",
            min: -12,
            max: 14,
            hintKey: "settings.timezoneHint",
          })}
        </div>
      </Card>

      <Card title={t("settings.sectionModel")}>
        <div className="grid grid-2">
          <Field label={t("settings.model")} hint={t("settings.modelHint")}>
            {(id) => (
              <ModelPicker id={id} value={value.model} onChange={(next) => patch("model", next)} />
            )}
          </Field>
          {numberField({
            labelKey: "settings.temperature",
            key: "temperature",
            min: 0,
            max: 2,
            step: 0.1,
            hintKey: "settings.temperatureHint",
          })}
          {numberField({ labelKey: "settings.maxTokens", key: "maxTokens", min: 64, max: 4000 })}
          {numberField({ labelKey: "settings.maxWords", key: "maxWords", min: 20, max: 600 })}
        </div>
      </Card>

      <Card title={t("settings.sectionSecurity")}>
        <div className="stack">
          <Toggle
            label={t("settings.injectionGuard")}
            checked={value.injectionGuard}
            onChange={(next) => patch("injectionGuard", next)}
          />
          <p className="hint">{t("settings.injectionGuardHint")}</p>
          {value.injectionGuard
            ? numberField({
                labelKey: "settings.quoteMaxLength",
                key: "quoteMaxLength",
                min: 40,
                max: 2000,
              })
            : null}
        </div>
      </Card>

      <Card title={t("settings.sectionBehavior")}>
        <div className="stack">
          <Toggle
            label={t("settings.paused")}
            checked={value.paused}
            onChange={(next) => patch("paused", next)}
          />
          <p className="hint">{t("settings.pausedHint")}</p>
          {numberField({
            labelKey: "settings.deliveryRetention",
            key: "deliveryRetentionDays",
            min: 1,
            max: 365,
          })}
        </div>
      </Card>

      <Card title={t("settings.sectionSecrets")} hint={t("settings.secretsHint")}>
        <SecretBadges secrets={secrets} />
      </Card>
    </div>
  );
}
