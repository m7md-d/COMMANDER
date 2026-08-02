import { useMemo, type ReactNode } from "react";
import { buildTree, type CheckConfigMap, type TreeSnapshot } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatBytes, formatDateTime } from "@/shared/lib/format";
import { TreeRow } from "./TreeRow";

interface TreeChartProps {
  snapshot: TreeSnapshot;
  selected: string | null;
  onSelect: (path: string) => void;
  /** Sits on the head beside the sync stamp, where the reason to press it is. */
  actions: ReactNode;
  /** What "over the limit" means here — the front's own resolved limits, so the
   *  chart marks exactly what the engine would charge somebody for. */
  checks: CheckConfigMap;
}

/**
 * The chart: a ruled plan of the project, readable before it is opened.
 *
 * Every directory carries the totals of everything under it, so the collapsed
 * view already answers "where does the weight of this project sit" — opening a
 * branch details an answer you already have rather than revealing one you did
 * not. That is the whole reason this is not a file explorer sidebar.
 */
export function TreeChart({ snapshot, selected, onSelect, actions, checks }: TreeChartProps) {
  const t = useTranslate();
  // Rebuilt only when the rows change: the same list always yields the same
  // chart, so re-deriving it on an unrelated render would be pure waste.
  const root = useMemo(() => buildTree(snapshot.files, checks), [snapshot.files, checks]);
  const size = formatBytes(root.totals.bytes);

  return (
    <section className="chart" aria-label={t("tree.chart")}>
      <div className="chart-head">
        <span className="stencil">{t("tree.chart")}</span>
        <span className="survey-total">{t("recon.files", { count: snapshot.totalFiles })}</span>
        <span className="survey-total">{t(size.unit, { value: size.value })}</span>
        <span className="survey-when">
          {t("tree.synced")} {formatDateTime(snapshot.syncedAt, t("tree.never"))}
        </span>
        <div className="spacer" />
        {actions}
      </div>

      {snapshot.truncated ? <p className="survey-caution">{t("tree.truncated")}</p> : null}
      {snapshot.capped ? (
        <p className="survey-caution">
          {t("tree.capped", { shown: snapshot.files.length, total: snapshot.totalFiles })}
        </p>
      ) : null}

      <div className="chart-body">
        {root.children.map((node) => (
          <TreeRow
            key={node.path}
            node={node}
            totalBytes={root.totals.bytes}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
