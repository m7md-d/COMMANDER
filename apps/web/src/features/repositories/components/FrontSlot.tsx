import { Link } from "react-router-dom";
import type { Repository } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { activeRuleCount, highestGravity, TOTAL_RULES } from "@/features/repositories/present";

interface FrontSlotProps {
  repository: Repository;
  serial: string;
}

/**
 * One front's position on the board.
 *
 * The whole slot is the link, so the target is a band the width of the screen
 * rather than a word — the difference between a board you operate and a list
 * you aim at. State is carried twice on purpose: the lamp for the sweep down
 * the column, and the word in the caption for anyone who cannot use the lamp.
 */
export function FrontSlot({ repository, serial }: FrontSlotProps) {
  const t = useTranslate();
  const gravity = highestGravity(repository.watchers);

  return (
    <Link to={`/repositories/${repository.id}`} className="board-slot">
      <span className="board-mark">
        <span
          className={`board-lamp ${repository.enabled ? "board-lamp-live" : ""}`}
          aria-hidden="true"
        />
        <span className="board-serial">{serial}</span>
      </span>

      <span className="board-body">
        <span className="board-subject ltr">{repository.fullName || t("state.unnamed")}</span>
        <span className="board-tags">
          <span>{repository.enabled ? t("state.enabled") : t("state.disabled")}</span>
          <span>{t(`stage.${repository.projectStage}.label`)}</span>
          <span>{t(`gravity.${gravity}.label`)}</span>
          <span>
            {repository.branches.length === 0
              ? t("front.branchesAll")
              : t("front.branchesCount", { count: repository.branches.length })}
          </span>
        </span>
      </span>

      <dl className="board-figures">
        <div>
          <dt>{t("front.figMembers")}</dt>
          <dd>{repository.members.length}</dd>
        </div>
        <div>
          <dt>{t("front.figWatchers")}</dt>
          <dd>{repository.watchers.length}</dd>
        </div>
        <div>
          <dt>{t("front.figRules")}</dt>
          <dd>
            {t("front.rulesActive", {
              active: activeRuleCount(repository.rules),
              total: TOTAL_RULES,
            })}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
