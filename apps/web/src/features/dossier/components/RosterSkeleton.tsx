/** Five rows: enough to show the list is a list, short enough to be honest. */
const ROWS = 5;

/**
 * The dossier roster, blank.
 *
 * Each row is a name over a login with a score at the end, so it is twice a
 * line's height. The roster sits in the aside column and the detail pane sizes
 * against it, which is why getting this height wrong moved two panes at once.
 */
export function RosterSkeleton() {
  return (
    <div className="pick-list" aria-hidden="true">
      {Array.from({ length: ROWS }, (_, index) => (
        <div className="pick-item" key={index}>
          <span className="stack-sm">
            <span className="skeleton-line sk-short sk-label" />
            <span className="skeleton-line sk-short sk-tag" />
          </span>
          <span className="spacer" />
          <span className="skeleton-line sk-short sk-figure" />
        </div>
      ))}
    </div>
  );
}
