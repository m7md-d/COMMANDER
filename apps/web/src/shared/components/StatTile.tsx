interface StatTileProps {
  /** `null` means "not known", which is not the same claim as zero. */
  value: number | null;
  label: string;
  /** Shown in place of a null value. */
  unknownLabel?: string;
}

/**
 * A single figure. The null case exists because the previous signature forced
 * callers to pass 0 when the data was simply unavailable — and "0" asserts that
 * the value is known and happens to be nothing (docs/UI-AUDIT.md §15).
 */
export function StatTile({ value, label, unknownLabel = "—" }: StatTileProps) {
  return (
    <div className="stat">
      <strong className="stat-value">
        {value === null ? unknownLabel : value.toLocaleString()}
      </strong>
      <span className="stat-label">{label}</span>
    </div>
  );
}
