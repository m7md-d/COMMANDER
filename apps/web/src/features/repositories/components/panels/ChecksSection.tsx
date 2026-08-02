import { resolveChecks, type CheckConfigMap } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Field } from "@/shared/components/Field";
import { PanelSection } from "@/shared/components/PanelSection";
import { Select } from "@/shared/components/Select";
import { useCheckTemplates } from "@/features/repositories/hooks";
import { CheckFields } from "@/features/repositories/components/CheckFields";
import type { FrontDraft } from "@/features/repositories/useFrontDraft";

interface ChecksSectionProps {
  draft: FrontDraft;
}

/** No template chosen. Empty rather than a sentinel id, so the value is falsy in
 *  exactly the place the API wants null. */
const NO_TEMPLATE = "";

/**
 * The front's own check limits: which template it inherits, and what it
 * overrides.
 *
 * Sits under the rules of engagement rather than in a tab of its own because it
 * answers the same question they do — what counts as a violation here. The
 * difference is only where the evidence comes from, and that is the section's
 * hint, not a reason to make the operator go somewhere else.
 */
export function ChecksSection({ draft }: ChecksSectionProps) {
  const t = useTranslate();
  const { value, patch } = draft;
  const templates = useCheckTemplates();

  const chosen = templates.data?.templates.find((entry) => entry.id === value.checkTemplateId);
  // What the front's fields fall back to: its template layered over the shipped
  // defaults. Resolved with the same function the engine judges by, so the
  // "inherited" hint cannot claim a number the check would not use.
  const inherited: CheckConfigMap = resolveChecks(chosen?.checks ?? null, null);

  return (
    <PanelSection label={t("checks.section")} hint={t("checks.sectionHint")}>
      <div className="stack">
        <Field label={t("checks.template")} hint={t("checks.templateHint")}>
          {(id) => (
            <Select
              id={id}
              value={value.checkTemplateId ?? NO_TEMPLATE}
              onValueChange={(next) => patch("checkTemplateId", next === NO_TEMPLATE ? null : next)}
              options={[
                { value: NO_TEMPLATE, label: t("checks.templateNone") },
                ...(templates.data?.templates ?? []).map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                })),
              ]}
            />
          )}
        </Field>

        <CheckFields
          value={value.checks}
          onChange={(checks) => patch("checks", checks)}
          inherited={inherited}
        />
      </div>
    </PanelSection>
  );
}
