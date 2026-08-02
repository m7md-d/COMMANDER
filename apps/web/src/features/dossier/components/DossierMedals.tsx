import type { Achievement, AchievementGrade } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";

const GRADE_PIPS: Record<AchievementGrade, number> = { bronze: 1, silver: 2, gold: 3 };

/**
 * The record's medals and marks: commendations to the left in the record's
 * favour, reprimands as the marks against it. Grade is the row of pips — one for
 * bronze, three for gold. Kind, not colour alone, sets the tone (the pips and
 * the inked edge agree), so the register reads without relying on hue.
 */
export function DossierMedals({ achievements }: { achievements: Achievement[] }) {
  const t = useTranslate();

  return (
    <Card title={t("dossier.medals")}>
      {achievements.length === 0 ? (
        <EmptyState message={t("dossier.medalsEmpty")} />
      ) : (
        <div className="medals">
          {achievements.map((achievement) => (
            <article key={achievement.id} className={`medal medal-${achievement.kind}`}>
              <span className="medal-pips" aria-hidden="true">
                {Array.from({ length: GRADE_PIPS[achievement.grade] }).map((_, index) => (
                  <span key={index} className="pip" />
                ))}
              </span>
              <span className="medal-body">
                <span className="medal-name">{t(`achv.${achievement.id}.name`)}</span>
                <span className="medal-note">
                  {t(
                    `achv.${achievement.id}.note`,
                    achievement.value !== undefined ? { value: achievement.value } : undefined,
                  )}
                </span>
              </span>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
