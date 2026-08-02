/** How many slots to reserve. Three is the median board; more would overstate. */
const SLOTS = 3;

/**
 * The situation board, blank.
 *
 * Built from `.board` and `.board-slot` themselves rather than from a drawing
 * of them, so the reserved geometry is the real geometry — the same grid, the
 * same three zones, the same padding. When the fronts arrive they land exactly
 * where the blanks were.
 */
export function BoardSkeleton() {
  return (
    <div className="board" aria-hidden="true">
      {Array.from({ length: SLOTS }, (_, index) => (
        <div className="board-slot" key={index}>
          <span className="board-mark">
            <span className="board-lamp" />
            <span className="skeleton-line sk-short sk-figure" />
          </span>

          <span className="board-body">
            <span className="skeleton-line sk-subject" />
            <span className="skeleton-line sk-short sk-line" />
          </span>

          <dl className="board-figures">
            {["a", "b", "c"].map((cell) => (
              <div key={cell}>
                <dt>
                  <span className="skeleton-line sk-short sk-figure" />
                </dt>
                <dd>
                  <span className="skeleton-line sk-figure" />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
