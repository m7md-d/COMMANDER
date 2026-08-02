/**
 * Per-branch watchers: who reports on a branch, and how heavily it weighs.
 *
 * A push to `main` is not a push to `feature/spike`, but the difference is
 * **gravity, never rigour** — the same model reads the same diff at the same
 * depth on every branch, because the point of the platform is clean work, not
 * cheap coverage. What gravity changes is how formally the communiqué is worded
 * and how much a violation on that branch weighs.
 *
 * Resolution is first-match-wins over an ordered list, which is why the list is
 * ordered and not a map: `main` must be able to win before `*` catches the rest.
 */

import { z } from "zod";
import { cuidSchema } from "../contracts/common.js";

export const GRAVITY_LEVELS = ["routine", "guarded", "critical"] as const;
export type Gravity = (typeof GRAVITY_LEVELS)[number];

export const DEFAULT_GRAVITY: Gravity = "routine";

export const watcherSchema = z.object({
  /** Same matching as watched branches: exact, or a single trailing `*`. */
  pattern: z.string().trim().min(1, "repos.branchEmpty").max(120).regex(/^[^\s]+$/, "repos.branchInvalid"),
  gravity: z.enum(GRAVITY_LEVELS).default(DEFAULT_GRAVITY),
  /** Falls back to the repository's own persona when null. */
  promptId: cuidSchema.nullable().default(null),
  /** Falls back to the repository model, then the global one, when empty. */
  model: z.string().trim().max(120).default(""),
});

export type Watcher = z.infer<typeof watcherSchema>;

export const watchersSchema = z.array(watcherSchema).max(20).default([]);

/** True when `branch` is covered by `pattern`, matching watched-branch rules. */
export function patternMatches(pattern: string, branch: string): boolean {
  const clean = pattern.trim();
  if (!clean) return false;
  if (clean === "*") return true;
  if (clean.endsWith("*")) return branch.startsWith(clean.slice(0, -1));
  return clean === branch;
}

/**
 * The watcher governing this branch. With no list configured every branch is
 * routine and the repository's own prompt and model apply — so adding the
 * feature changes nothing until someone deliberately marks a branch.
 */
export function resolveWatcher(watchers: Watcher[], branch: string): Watcher {
  const match = watchers.find((watcher) => patternMatches(watcher.pattern, branch));
  return match ?? { pattern: branch, gravity: DEFAULT_GRAVITY, promptId: null, model: "" };
}
