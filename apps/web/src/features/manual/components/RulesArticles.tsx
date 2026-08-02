import {
  CHECK_METRICS,
  DEFAULT_CHECKS,
  defaultRuleConfig,
  RULE_IDS,
  RULE_SEVERITY,
} from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Article } from "./Article";
import { FactTable } from "./FactTable";

/** The shipped default, read from the same function a new front is created with. */
const DEFAULTS = defaultRuleConfig();

/**
 * The eight rules, and the three that do not do what their name suggests.
 *
 * The table is generated from RULE_IDS, so a rule added to the engine appears
 * here without anyone remembering to document it — and one removed cannot be
 * left behind as a paragraph describing a check that no longer runs.
 */
export function RulesArticles() {
  const t = useTranslate();
  const config = (id: (typeof RULE_IDS)[number]) => DEFAULTS[id] as Record<string, unknown>;

  const threshold = (id: (typeof RULE_IDS)[number]) => {
    const values = config(id);
    if (typeof values.threshold === "number") return String(values.threshold);
    if (typeof values.minLength === "number") return String(values.minLength);
    if (typeof values.startHour === "number") return `${values.startHour}–${values.endHour}`;
    return t("state.none");
  };

  return (
    <>
      <Article title={t("manual.rules.table.title")} body={t("manual.rules.table.body")}>
        <FactTable
          head={[
            t("manual.col.rule"),
            t("manual.col.default"),
            t("manual.col.threshold"),
            t("manual.col.severity"),
          ]}
          rows={RULE_IDS.map((id) => [
            t(`rule.${id}.label`),
            DEFAULTS[id].enabled ? t("state.enabled") : t("state.disabled"),
            threshold(id),
            RULE_SEVERITY[id].toFixed(1),
          ])}
        />
      </Article>

      {/* Generated from CHECK_METRICS for the same reason the rules table is
          generated from RULE_IDS: a metric added to the engine documents itself,
          and the manual cannot describe one that no longer runs. */}
      <Article title={t("manual.rules.checks.title")} body={t("manual.rules.checks.body")}>
        <FactTable
          head={[
            t("manual.col.metric"),
            t("manual.col.limit"),
            t("manual.col.scope"),
            t("manual.col.severity"),
          ]}
          rows={CHECK_METRICS.map((metric) => [
            t(`rule.${metric}.label`),
            String(DEFAULT_CHECKS[metric].threshold),
            t("manual.checks.scopeValue", {
              include: DEFAULT_CHECKS[metric].include.length,
              exclude: DEFAULT_CHECKS[metric].exclude.length,
            }),
            RULE_SEVERITY[metric].toFixed(1),
          ])}
        />
      </Article>

      <Article title={t("manual.rules.directPush.title")} body={t("manual.rules.directPush.body")} />
      <Article title={t("manual.rules.lazy.title")} body={t("manual.rules.lazy.body")} />
      <Article title={t("manual.rules.night.title")} body={t("manual.rules.night.body")} />
      <Article title={t("manual.rules.disabled.title")} body={t("manual.rules.disabled.body")} />
      <Article title={t("manual.rules.review.title")} body={t("manual.rules.review.body")} />
    </>
  );
}
