interface SkeletonProps {
  /** How many placeholder lines to draw. */
  lines?: number;
  /** Draw them inside a card-shaped block, for a panel that has not arrived. */
  block?: boolean;
}

/**
 * The generic placeholder: a ragged stack of lines.
 *
 * Correct where the eventual content really is prose or a short list. Where it
 * is a board, a file or a log of slips, pass a shaped skeleton to QueryState
 * instead — this stack would reserve the wrong height and the page would jump
 * by the difference (docs/UI-AUDIT.md §6).
 *
 * `aria-hidden` because the region already announces itself as busy; a screen
 * reader must not also read out a row of empty boxes.
 */
export function Skeleton({ lines = 3, block = false }: SkeletonProps) {
  return (
    <div className={block ? "skeleton-block" : "stack-sm skeleton-lines"} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="skeleton-line" />
      ))}
    </div>
  );
}
