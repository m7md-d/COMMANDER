import { RosterSkeleton } from "./RosterSkeleton";

/**
 * The dossier screen's two columns, blank.
 *
 * Reserves the aside grid rather than the roster alone, because the roster and
 * the detail pane arrive from two different queries: without the right-hand
 * column held open, the roster resolves first and the page reflows twice — once
 * into a single column, then again when the detail lands beside it.
 */
export function DossierSkeleton() {
  return (
    <div className="grid grid-aside" aria-hidden="true">
      <section className="card">
        <RosterSkeleton />
      </section>

      <section className="card">
        <div className="stack">
          <span className="skeleton-line sk-control sk-subject" />
          <span className="skeleton-line sk-short sk-line" />
          <span className="skeleton-line sk-short sk-full" />
          <span className="skeleton-line sk-short sk-line" />
        </div>
      </section>
    </div>
  );
}
