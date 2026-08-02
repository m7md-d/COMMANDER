import { GRAVITY_LEVELS, GRAVITY_SHIFT } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { ChipInput } from "@/shared/components/ChipInput";
import { PanelSection } from "@/shared/components/PanelSection";
import { WatcherFields } from "@/features/repositories/components/WatcherFields";
import { shiftKey } from "@/shared/lib/tone";
import type { FrontDraft } from "@/features/repositories/useFrontDraft";

interface BranchesPanelProps {
  draft: FrontDraft;
}

/**
 * The two branch lists, which are easy to confuse and are therefore separated
 * by a rule and named for what they decide: the first says *whether* a push is
 * reported at all, the second says *how heavily* it is judged. A single list
 * would suggest they are the same setting.
 */
export function BranchesPanel({ draft }: BranchesPanelProps) {
  const t = useTranslate();
  const { value, patch } = draft;

  return (
    <>
      <PanelSection label={t("repos.branches")} hint={t("repos.branchesHint")}>
        <ChipInput
          values={value.branches}
          onChange={(next) => patch("branches", next)}
          addLabel={t("repos.branchAdd")}
          removeLabel={t("action.delete")}
        />
      </PanelSection>

      <PanelSection label={t("repos.watchers")} hint={t("repos.watchersHint")}>
        {/* The standings, once, above the rows. A ladder per row would repeat the
            same scale as many times as there are watchers; the scale is a fact
            about the platform, not about any one branch. */}
        <dl className="gravity-key">
          {GRAVITY_LEVELS.map((level) => (
            <div key={level}>
              <dt>{t(`gravity.${level}.label`)}</dt>
              <dd>{t(shiftKey(GRAVITY_SHIFT[level]))}</dd>
            </div>
          ))}
        </dl>

        <WatcherFields watchers={value.watchers} onChange={(next) => patch("watchers", next)} />
      </PanelSection>
    </>
  );
}
