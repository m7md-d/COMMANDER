/** Slips are tall; three fill the fold without promising a page that is empty. */
const SLIPS = 3;

/**
 * The dispatch log, blank.
 *
 * A slip carries its stamp, its front and its axis on separate ruled blocks, so
 * it stands roughly three times the height of a line of prose — the shape the
 * generic placeholder was furthest from, and the page that jumped the most when
 * the log arrived. Built from `.dispatch`'s own blocks so the reserved height is
 * the height a real slip will take.
 */
export function SlipsSkeleton() {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: SLIPS }, (_, index) => (
        <article className="dispatch" key={index}>
          <header className="dispatch-head">
            <span className="skeleton-line sk-control sk-tag" />
            <span className="spacer" />
            <span className="skeleton-line sk-short sk-label" />
          </header>

          <div className="dispatch-front-block">
            <span className="skeleton-line sk-short sk-tag" />
            <span className="skeleton-line sk-subject" />
          </div>

          <div className="dispatch-axis-block">
            <span className="skeleton-line sk-short sk-tag" />
            <span className="skeleton-line sk-short sk-label" />
          </div>
        </article>
      ))}
    </div>
  );
}
