import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  invalid?: boolean;
}

export function Textarea({ invalid = false, rows = 10, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      rows={rows}
      className={invalid ? "control control-invalid" : "control"}
      aria-invalid={invalid || undefined}
    />
  );
}
