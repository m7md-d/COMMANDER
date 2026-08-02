import { Button } from "./Button";

interface ChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  addLabel: string;
  removeLabel: string;
  placeholder?: string;
}

/**
 * Editable list of short strings (branch patterns). Each chip is an input so a
 * typo is corrected in place instead of remove-and-retype.
 */
export function ChipInput({
  values,
  onChange,
  addLabel,
  removeLabel,
  placeholder,
}: ChipInputProps) {
  const update = (index: number, next: string) => {
    onChange(values.map((value, position) => (position === index ? next : value)));
  };

  return (
    <div className="chip-list">
      {values.map((value, index) => (
        // Index as key is acceptable here only because the list is never
        // reordered — items are appended and removed by position.
        <span className="chip" key={`chip-${index}`}>
          <input
            className="chip-input ltr"
            value={value}
            placeholder={placeholder}
            onChange={(event) => update(index, event.target.value)}
            aria-label={`${addLabel} ${index + 1}`}
          />
          <button
            type="button"
            className="chip-remove"
            aria-label={removeLabel}
            onClick={() => onChange(values.filter((_, position) => position !== index))}
          >
            ×
          </button>
        </span>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...values, ""])}>
        + {addLabel}
      </Button>
    </div>
  );
}
