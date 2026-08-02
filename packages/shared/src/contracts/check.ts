/**
 * Check configuration as it crosses the wire and lands in a JSON column.
 *
 * Validated on read, like `rules` and `settings`, for the same reason: the shape
 * varies per metric and adding a knob should not need a migration. What it must
 * never become is trusted — a stored document written by an older shape has to
 * fail loudly at the boundary rather than reach `judgeCheck` as a threshold of
 * `undefined`, which compares false against everything and quietly stops
 * reporting.
 */

import { z } from "zod";
import { CHECK_METRICS } from "../domain/checks.js";

/** Patterns are matched by our own small glob (see check-scope.ts). Bounded so a
 *  pasted .gitignore cannot turn one front's config into a scan of its own. */
const patternSchema = z.array(z.string().trim().min(1).max(200)).max(60);

/**
 * Every field optional: this is a *layer*, not a complete configuration. A front
 * that only wants a different threshold says exactly that, and the scope beneath
 * it stays in force.
 */
export const checkConfigSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().int().min(1).max(100_000).optional(),
  include: patternSchema.optional(),
  exclude: patternSchema.optional(),
});

export const checkMapSchema = z.record(z.enum(CHECK_METRICS), checkConfigSchema);

export const checkTemplateInputSchema = z.object({
  name: z.string().trim().min(1, "checks.nameRequired").max(60),
  checks: checkMapSchema,
});

export type CheckTemplateInput = z.infer<typeof checkTemplateInputSchema>;

export interface CheckTemplate extends CheckTemplateInput {
  id: string;
  /** How many fronts inherit this template — deleting one that is in use
   *  changes what those fronts are judged by, so the count is shown first. */
  repositoryCount: number;
  createdAt: string;
  updatedAt: string;
}
