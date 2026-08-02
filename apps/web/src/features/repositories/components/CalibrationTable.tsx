import type { ProjectStage } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { calibrate, PROBE_RULES } from "@/features/repositories/calibration";

interface CalibrationTableProps {
  stage: ProjectStage;
}

/**
 * The register this stage produces, per branch standing, for two named rules.
 *
 * Reads as a firing table: the standings down the side, the two probe offences
 * across the top, and the resulting register in each cell. Change the stage
 * above and every cell moves — which is the only demonstration of what the
 * setting does that cannot go stale.
 */
export function CalibrationTable({ stage }: CalibrationTableProps) {
  const t = useTranslate();

  return (
    <table className="calib">
      <caption className="hint">{t("tone.calibCaption")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("repos.watcherGravity")}</th>
          {PROBE_RULES.map((ruleId) => (
            <th scope="col" key={ruleId}>
              {t(`rule.${ruleId}.label`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {calibrate(stage).map((row) => (
          <tr key={row.gravity}>
            <th scope="row">{t(`gravity.${row.gravity}.label`)}</th>
            {row.levels.map((level, index) => (
              <td key={PROBE_RULES[index]}>
                <span className={`calib-level calib-${level}`}>{t(`tone.${level}.label`)}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
