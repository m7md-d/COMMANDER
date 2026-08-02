import type { TreeTotals } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatBytes } from "@/shared/lib/format";

interface TreeFiguresProps {
  totals: TreeTotals;
  /** The whole project's byte count — every bar is a share of the same whole, so
   *  a bar at depth four is comparable with one at depth one. */
  totalBytes: number;
  /** A directory counts its files; a file states its own measurement. */
  kind: "dir" | "file";
}

/**
 * The right-hand cluster of a chart row: share, figure, standing.
 *
 * One component for both kinds of row on purpose. The bar is the same bar the
 * survey and the dossier use (`.meter-*`) — a third bar vocabulary would make
 * two proportions on one screen impossible to compare, which is the only thing
 * a bar is for.
 *
 * A file reports its **lines** once counted and falls back to its byte length
 * until then, because bytes are what we honestly know before a measurement.
 */
export function TreeFigures({ totals, totalBytes, kind }: TreeFiguresProps) {
  const t = useTranslate();
  const percent = totalBytes > 0 ? Math.round((totals.bytes / totalBytes) * 100) : 0;
  const size = formatBytes(totals.bytes);
  const counted = kind === "file" && totals.measured > 0;

  return (
    <>
      <span
        className="meter-track chart-share"
        role="img"
        aria-label={t("tree.shareOf", { percent })}
      >
        {/* Width is data, not identity: this node's share of the whole. */}
        <span className="meter-fill" style={{ inlineSize: `${percent}%` }} />
      </span>

      <span className="chart-figure">
        {kind === "dir" ? t("recon.files", { count: totals.files }) : null}
        {counted ? t("tree.linesValue", { count: totals.lines }) : null}
        {kind === "file" && !counted ? t(size.unit, { value: size.value }) : null}
      </span>

      {/* State, not blame: how much is over the limit under here. Who is
          answerable for a file being over is decided at the crossing, not by
          this count — a project can be inherited already over. */}
      {totals.over > 0 ? (
        <span className="chart-over">{t("tree.overLimit", { count: totals.over })}</span>
      ) : (
        // Blank rather than a dash when nobody owns it: an empty cell reads as
        // "nothing on record", a placeholder reads as a value.
        <span className="chart-owner">{totals.topOwner}</span>
      )}
    </>
  );
}
