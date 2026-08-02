interface FormSkeletonProps {
  /** How many fields the form has. Count the real ones; guessing defeats it. */
  fields?: number;
  /** Two columns where the form uses `.grid-2`, one where it stacks. */
  columns?: 1 | 2;
}

/**
 * A form, blank.
 *
 * The generic line stack is wrong here for a specific reason: a field is a
 * label *and* a control, roughly three times a line's height, and forms are
 * where the panel does most of its waiting. Reserving label-plus-control at the
 * real spacing is what keeps a settings page from sliding when it resolves.
 */
export function FormSkeleton({ fields = 4, columns = 2 }: FormSkeletonProps) {
  return (
    <div className={columns === 2 ? "grid grid-2" : "stack"} aria-hidden="true">
      {Array.from({ length: fields }, (_, index) => (
        <div className="sk-field" key={index}>
          <span className="skeleton-line sk-short sk-label" />
          <span className="skeleton-line sk-control sk-full" />
        </div>
      ))}
    </div>
  );
}
