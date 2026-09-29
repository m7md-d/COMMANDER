import { useId } from "react";
import type { ReactElement } from "react";

/**
 * The id of a Field's own <label>. A group of controls — chips, checkboxes — has
 * no single element a <label> can name, so it takes `aria-labelledby` with this
 * instead (docs/UI-DEFECTS.md W-12).
 */
export const labelOf = (id: string): string => `${id}-label`;

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Receives the generated id so the label's htmlFor always matches. */
  children: (id: string) => ReactElement;
}

/**
 * Every control gets a real <label> bound by id (CONSTITUTION §7). Generating
 * the id here rather than asking callers for one removes the chance of a
 * duplicate or a mismatch.
 */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();

  return (
    <div className="field">
      <label className="field-label" htmlFor={id} id={labelOf(id)}>
        {label}
      </label>
      {children(id)}
      {hint && !error ? <span className="hint">{hint}</span> : null}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
