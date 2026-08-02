import { useId } from "react";

export interface LadderRung {
  value: string;
  label: string;
  /** What choosing this rung does, in words. Printed under the label. */
  note: string;
}

interface LadderProps {
  legend: string;
  rungs: LadderRung[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * A calibration selector: the whole scale is visible and you sit on one notch of
 * it, the way a switch on a panel shows every position it can take.
 *
 * A `<select>` would be smaller and would hide the thing that matters. These
 * values are not a list of unrelated options — they are an ordered scale where
 * the neighbours are the point, and choosing one only makes sense against what
 * is either side of it.
 *
 * Built on native radios inside a fieldset, deliberately: that is already the
 * correct semantics for "one of an ordered set", it gives arrow-key traversal
 * and the group name for free, and it needs no new dependency (web
 * CONSTITUTION §8 is a permission, not an instruction).
 */
export function Ladder({ legend, rungs, value, onChange }: LadderProps) {
  const name = useId();

  return (
    <fieldset className="ladder">
      <legend className="stencil">{legend}</legend>
      <div className="ladder-rungs">
        {rungs.map((rung) => (
          <label className="ladder-rung" key={rung.value}>
            <input
              className="ladder-input"
              type="radio"
              name={name}
              value={rung.value}
              checked={value === rung.value}
              onChange={() => onChange(rung.value)}
            />
            <span className="ladder-notch" aria-hidden="true" />
            <span className="ladder-label">{rung.label}</span>
            <span className="ladder-note">{rung.note}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
