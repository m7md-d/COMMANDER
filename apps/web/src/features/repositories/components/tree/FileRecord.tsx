import {
  CHECK_METRICS,
  inScope,
  type CheckConfigMap,
  type CheckMetric,
  type TreeFile,
} from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatBytes, formatDateTime } from "@/shared/lib/format";
import { EmptyState } from "@/shared/components/EmptyState";

/** Enough of a blob sha to identify it by eye; the whole forty is unreadable. */
const SHA_LENGTH = 12;

interface FileRecordProps {
  file: TreeFile;
  /** The limits this front is judged by, already resolved through its template. */
  checks: CheckConfigMap;
}

/**
 * One file's record: where it is, what it measures, and who made it.
 *
 * Set as particulars — the same ruled cells as the front's letterhead — because
 * this is the same kind of object: a small set of readings about one thing, not
 * a form and not a paragraph.
 *
 * Every metric gets a row whether or not it has a number, and the row says
 * *which* kind of absence it is: out of scope, switched off, or read and not
 * countable. A missing row would leave the reader to guess, which is the one
 * thing this subsystem is built not to make anybody do.
 */
export function FileRecord({ file, checks }: FileRecordProps) {
  const t = useTranslate();
  const size = formatBytes(file.bytes);

  const reading = (metric: CheckMetric) => {
    const config = checks[metric];
    if (!config.enabled) return { text: t("state.disabled"), over: false };
    if (!inScope(config, file.path)) return { text: t("tree.outOfScope"), over: false };

    const value = file.metrics[metric];
    if (value === null) return { text: t("tree.unmeasured"), over: false };

    return {
      text: t("tree.against", { value, threshold: config.threshold }),
      over: value > config.threshold,
    };
  };

  return (
    <div className="stack">
      <span className="stencil">{t("tree.record")}</span>
      <strong className="chart-path ltr">{file.path}</strong>

      <dl className="file-particulars">
        <div>
          <dt>{t("tree.size")}</dt>
          <dd>{t(size.unit, { value: size.value })}</dd>
        </div>
        {CHECK_METRICS.map((metric) => {
          const shown = reading(metric);
          return (
            <div key={metric}>
              <dt>{t(`rule.${metric}.label`)}</dt>
              <dd className={shown.over ? "chart-over" : undefined}>{shown.text}</dd>
            </div>
          );
        })}
        <div>
          <dt>{t("tree.blob")}</dt>
          <dd className="ltr">{file.blobSha.slice(0, SHA_LENGTH)}</dd>
        </div>
        <div>
          <dt>{t("tree.lastTouched")}</dt>
          <dd>{formatDateTime(file.lastTouchedAt, t("tree.neverTouched"))}</dd>
        </div>
      </dl>

      {file.metrics.file_lines === null ? (
        <p className="survey-caution">{t("tree.unmeasuredHint")}</p>
      ) : null}
      {file.baseline !== null && file.baseline > checks.file_lines.threshold ? (
        <p className="survey-caution">{t("tree.baselineHint", { lines: file.baseline })}</p>
      ) : null}

      <span className="stencil">{t("tree.owners")}</span>
      {file.owners.length === 0 ? (
        <EmptyState message={t("tree.noOwners")} />
      ) : (
        <div className="pick-list">
          {file.owners.map((owner) => (
            <div className="pick-item" key={owner.login}>
              <span className="stack-sm">
                <span>{owner.displayName}</span>
                <span className="chart-owner ltr">{owner.login}</span>
              </span>
              <span className="spacer" />
              <span className="chart-figure">
                {t("tree.ownerShare", {
                  lines: owner.linesAdded,
                  commits: owner.commitCount,
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
