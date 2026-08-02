import type { RuleId } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";

type ScoreByRule = Partial<Record<RuleId, number>>;

/**
 * Where the score comes from, rule by rule. Bars are relative to the heaviest
 * rule rather than to the score itself: the question this answers is "what is
 * driving this record", not "what fraction of a fixed ceiling".
 */
export function DossierBreakdown({ scoreByRule }: { scoreByRule: ScoreByRule }) {
  const t = useTranslate();

  const rows = (Object.entries(scoreByRule) as [RuleId, number][])
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1]);

  const heaviest = rows[0]?.[1] ?? 0;

  return (
    <Card title={t("dossier.breakdown")}>
      {rows.length === 0 ? (
        <EmptyState message={t("dossier.empty")} />
      ) : (
        <div className="stack-sm">
          {rows.map(([ruleId, weight]) => (
            <div className="meter" key={ruleId}>
              <span>{t(`rule.${ruleId}.label`)}</span>
              <span className="meter-track">
                {/* Width is data, not identity: this rule's share of the heaviest one. */}
                <span className="meter-fill" style={{ inlineSize: `${(weight / heaviest) * 100}%` }} />
              </span>
              <span className="meter-value">{weight.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
