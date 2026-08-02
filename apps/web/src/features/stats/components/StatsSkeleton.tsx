/** The six readings the operations room always shows. */
const TILES = 6;

/**
 * The sector's figures, blank.
 *
 * A stat tile is a large number over a small label, so it stands far taller
 * than a line of prose — and it sits at the very top of the operations room,
 * where a wrong reservation pushes everything below it down the page.
 */
export function StatsSkeleton() {
  return (
    <div className="grid grid-stats" aria-hidden="true">
      {Array.from({ length: TILES }, (_, index) => (
        <div className="stat" key={index}>
          <span className="skeleton-line sk-control sk-figure" />
          <span className="skeleton-line sk-short sk-label" />
        </div>
      ))}
    </div>
  );
}
