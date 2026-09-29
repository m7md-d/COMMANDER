import { useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";

interface CopyFieldProps {
  /** The id its Field's label points at. */
  id: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
}

export function CopyField({ id, value, copyLabel, copiedLabel }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard access needs a secure context; failing silently is better
      // than an error toast for something the user can still select manually.
    }
  };

  return (
    <div className="row">
      <Input id={id} value={value} readOnly ltr />
      <Button size="sm" onClick={() => void copy()}>
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  );
}
