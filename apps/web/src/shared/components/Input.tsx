import type { InputHTMLAttributes } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  invalid?: boolean;
  /** Forces LTR for URLs, repo names and model ids inside Arabic text. */
  ltr?: boolean;
}

export function Input({ invalid = false, ltr = false, ...rest }: InputProps) {
  const classes = ["control", invalid ? "control-invalid" : "", ltr ? "ltr" : ""]
    .filter(Boolean)
    .join(" ");

  return <input {...rest} className={classes} aria-invalid={invalid || undefined} />;
}
