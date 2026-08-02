import { FRONT_TABS } from "@/features/repositories/tabs";

/**
 * A front's file, blank: letterhead, index tabs, sheet.
 *
 * The tab strip is the part that matters. It is the tallest thing above the
 * fold and the last to be drawn if it is not reserved, so a generic placeholder
 * let the whole sheet slide down the moment the fronts query resolved.
 */
export function FileSkeleton() {
  return (
    <div aria-hidden="true">
      <header className="file-head">
        <div className="file-head-top">
          <span className="skeleton-line sk-short sk-label" />
          <span className="skeleton-line sk-short sk-tag" />
        </div>

        <span className="skeleton-line sk-control sk-subject" />

        <dl className="file-particulars">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index}>
              <dt>
                <span className="skeleton-line sk-short sk-tag" />
              </dt>
              <dd>
                <span className="skeleton-line sk-short sk-label" />
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="file-tabs">
        {FRONT_TABS.map((tab) => (
          <span className="file-tab" key={tab}>
            <span className="skeleton-line sk-short sk-tag" />
          </span>
        ))}
      </div>

      <div className="file-sheet">
        <div className="stack">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="sk-field" key={index}>
              <span className="skeleton-line sk-short sk-label" />
              <span className="skeleton-line sk-control sk-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
