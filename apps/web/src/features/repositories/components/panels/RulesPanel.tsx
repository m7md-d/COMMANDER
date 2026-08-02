import { RULE_IDS, type RuleId } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Toggle } from "@/shared/components/Toggle";
import { PanelSection } from "@/shared/components/PanelSection";
import {
  RuleFields,
  hasRuleTerms,
} from "@/features/repositories/components/RuleFields";
import type { FrontDraft } from "@/features/repositories/useFrontDraft";
import { ChecksSection } from "./ChecksSection";

interface RulesPanelProps {
  draft: FrontDraft;
}

/**
 * The rules of engagement as articles rather than cards: standing on the inked
 * edge, terms hung beneath the clause they belong to. A switched-off article
 * fades but stays legible — a rule you have disabled is information, and hiding
 * it would make the list lie about what is being enforced.
 */
export function RulesPanel({ draft }: RulesPanelProps) {
  const t = useTranslate();
  const { value, patch } = draft;
  const rules = value.rules;

  const patchRule = (ruleId: RuleId, next: Record<string, unknown>) =>
    patch("rules", { ...rules, [ruleId]: { ...rules[ruleId], ...next } });

  return (
    <>
      <PanelSection label={t("nav.rules")} hint={t("rules.subtitle")}>
        <div className="stack">
          {RULE_IDS.map((ruleId) => (
            <article
              key={ruleId}
              className={`clause ${rules[ruleId].enabled ? "clause-live" : ""}`}
            >
              <Toggle
                label={t(`rule.${ruleId}.label`)}
                checked={rules[ruleId].enabled}
                onChange={(enabled) => patchRule(ruleId, { enabled })}
              />
              <p className="hint clause-note">{t(`rule.${ruleId}.hint`)}</p>

              {rules[ruleId].enabled && hasRuleTerms(ruleId) ? (
                <div className="clause-terms">
                  <RuleFields
                    ruleId={ruleId}
                    config={rules[ruleId]}
                    onPatch={(next) => patchRule(ruleId, next)}
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </PanelSection>

      {/* Same question, different evidence: a rule reads the push, a check reads
          the tree. Sending the operator elsewhere to answer half of it would be
          the scattering the front file was built to end. */}
      <ChecksSection draft={draft} />
    </>
  );
}
