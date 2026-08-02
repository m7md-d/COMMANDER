/** Enough branches to read as a chart, few enough to be honest about it. */
const ROWS = 8;

/**
 * The chart and its record pane, blank.
 *
 * Built from the chart's own containers — `.grid-aside`, `.chart`, `.chart-head`
 * and `.chart-row` — so the reserved geometry cannot drift from the real one.
 * Both columns are held open, not the chart alone: the record pane sizes against
 * the chart, and leaving it out would reflow the page a second time.
 */
export function TreeSkeleton() {
  return (
    <div className="grid grid-aside" aria-hidden="true">
      <section className="chart">
        <div className="chart-head">
          <span className="skeleton-line sk-short sk-label" />
          <span className="skeleton-line sk-short sk-tag" />
        </div>

        <div className="chart-body">
          {Array.from({ length: ROWS }, (_, index) => (
            <div className="chart-row chart-dir" key={index}>
              <span className="skeleton-line sk-short sk-label" />
              <span className="meter-track chart-share" />
              <span className="skeleton-line sk-short sk-figure" />
              <span className="skeleton-line sk-short sk-tag" />
            </div>
          ))}
        </div>
      </section>

      <div className="stack">
        <span className="skeleton-line sk-control sk-subject" />
        <span className="skeleton-line sk-short sk-line" />
        <span className="skeleton-line sk-short sk-full" />
      </div>
    </div>
  );
}
