interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * The wrapping <label> makes the whole control clickable and gives the
 * checkbox its accessible name without a separate htmlFor.
 */
export function Toggle({ label, checked, onChange, disabled = false }: ToggleProps) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        className="toggle-input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}
