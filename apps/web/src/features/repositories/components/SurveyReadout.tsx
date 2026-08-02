import type { StructureDigest } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatDateTime } from "@/shared/lib/format";

interface SurveyReadoutProps {
  digest: StructureDigest;
  /** ISO timestamp of the pass that produced this, or null if unknown. */
  scannedAt: string | null;
}

/**
 * What reconnaissance found, kept on the sheet instead of announced and lost.
 *
 * The areas are bars because the question an operator actually has is not "how
 * many files are in src" but "where does the weight of this project sit" — and
 * a proportion answers that in one glance where a column of numbers does not.
 */
export function SurveyReadout({ digest, scannedAt }: SurveyReadoutProps) {
  const t = useTranslate();
  const largest = digest.areas[0]?.files ?? 1;

  return (
    <div className="survey">
      <div className="survey-head">
        <span className="stencil">{t("recon.title")}</span>
        <span className="survey-total">{t("recon.files", { count: digest.totalFiles })}</span>
        <span className="survey-when">{formatDateTime(scannedAt, t("recon.never"))}</span>
      </div>

      {digest.truncated ? <p className="survey-caution">{t("recon.truncated")}</p> : null}

      <div className="survey-group">
        <p className="stencil">{t("recon.areas")}</p>
        {digest.areas.map((area) => (
          <div className="meter" key={area.path}>
            <span className="survey-area ltr">{area.path}</span>
            <span className="meter-track">
              {/* Width is data, not identity: this area's share of the largest. */}
              <span className="meter-fill" style={{ inlineSize: `${(area.files / largest) * 100}%` }} />
            </span>
            <span className="meter-value">{area.files}</span>
          </div>
        ))}
      </div>

      {digest.extensions.length > 0 ? (
        <div className="survey-group">
          <p className="stencil">{t("recon.extensions")}</p>
          <div className="chip-list">
            {digest.extensions.map((entry) => (
              <span className="chip ltr" key={entry.ext}>
                {entry.ext} · {entry.files}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {digest.markers.length > 0 ? (
        <div className="survey-group">
          <p className="stencil">{t("recon.markers")}</p>
          <div className="chip-list">
            {digest.markers.map((marker) => (
              <span className="chip ltr" key={marker}>
                {marker}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
