import {
  GRAVITY_LEVELS,
  GRAVITY_SHIFT,
  PROJECT_STAGES,
  REPEAT_BANDS,
  STAGE_SHIFT,
  TONE_LEVELS,
} from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { shiftKey } from "@/shared/lib/tone";
import { Article } from "./Article";
import { FactTable } from "./FactTable";

/**
 * How hard the communiqué presses, and what moves it.
 *
 * The three tables are the three inputs to `computeTone`, printed from its own
 * constants. The one thing stated in prose rather than a table is the rule that
 * gravity never touches review depth — because that is a promise about what the
 * platform does *not* do, and there is no table of absences.
 */
export function CalibrationArticles() {
  const t = useTranslate();

  return (
    <>
      <Article title={t("manual.cal.worst.title")} body={t("manual.cal.worst.body")} />

      <Article title={t("manual.cal.repeat.title")} body={t("manual.cal.repeat.body")}>
        <FactTable
          head={[t("manual.col.occurrences"), t("manual.col.weight")]}
          rows={REPEAT_BANDS.map((band, index) => [
            Number.isFinite(band.upTo)
              ? t("manual.cal.upTo", { n: band.upTo })
              : t("manual.cal.beyond", { n: REPEAT_BANDS[index - 1]?.upTo ?? 0 }),
            `×${band.factor}`,
          ])}
        />
      </Article>

      <Article title={t("manual.cal.axis.title")} body={t("manual.cal.axis.body")}>
        <FactTable
          head={[t("manual.col.setting"), t("manual.col.shift")]}
          rows={[
            ...PROJECT_STAGES.map((stage) => [
              t(`stage.${stage}.label`),
              t(shiftKey(STAGE_SHIFT[stage])),
            ]),
            ...GRAVITY_LEVELS.map((gravity) => [
              t(`gravity.${gravity}.label`),
              t(shiftKey(GRAVITY_SHIFT[gravity])),
            ]),
          ]}
        />
      </Article>

      <Article title={t("manual.cal.registers.title")} body={t("manual.cal.registers.body")}>
        <FactTable
          head={[t("manual.col.register"), t("manual.col.meaning")]}
          rows={TONE_LEVELS.map((level) => [
            t(`tone.${level}.label`),
            t(`manual.register.${level}`),
          ])}
        />
      </Article>

      <Article title={t("manual.cal.depth.title")} body={t("manual.cal.depth.body")} />
      <Article title={t("manual.cal.clamp.title")} body={t("manual.cal.clamp.body")} />
    </>
  );
}
