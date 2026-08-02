import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "success" | "danger" | "info";

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
