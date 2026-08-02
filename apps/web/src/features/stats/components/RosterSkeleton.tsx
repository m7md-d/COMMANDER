/** Four records fill the leaderboard's grid at its usual width. */
const RECORDS = 4;

/**
 * The service records, blank.
 *
 * Built from `.roster` so the placeholder flows into the same auto-fill columns
 * the cards will use — one card per row on a phone, three on a desk, without
 * this file knowing either number.
 */
export function RosterSkeleton() {
  return (
    <div className="roster" aria-hidden="true">
      {Array.from({ length: RECORDS }, (_, index) => (
        <div className="roster-card" key={index}>
          <div className="roster-head">
            <div className="roster-id">
              <span className="skeleton-line sk-short sk-tag" />
              <span className="skeleton-line sk-label" />
            </div>
            <span className="skeleton-line sk-control sk-tag" />
          </div>

          <dl className="roster-figures">
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
