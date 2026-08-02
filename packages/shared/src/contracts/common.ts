/**
 * The envelope every endpoint uses. CONSTITUTION.md §6: one error shape, and
 * `error` is an i18n key, never a sentence.
 */

import { z } from "zod";

export const fieldIssueSchema = z.object({
  /** Dot path into the submitted body, e.g. "branches.0". */
  path: z.string(),
  /** i18n key suffix under `error.*`. */
  code: z.string(),
  /** Interpolated into the message; never prose itself. */
  value: z.union([z.string(), z.number()]).optional(),
});

export type FieldIssue = z.infer<typeof fieldIssueSchema>;

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: string;
  details?: FieldIssue[];
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const cuidSchema = z.string().min(1);

/** GitHub's own constraint: owner/repo, each segment word chars, dot or dash. */
export const repoFullNameSchema = z
  .string()
  .trim()
  .regex(/^[\w.-]+\/[\w.-]+$/, "repos.fullNameInvalid");

/**
 * Discord rotates its webhook host between discord.com and discordapp.com and
 * exposes canary/ptb variants; all are legitimate.
 */
export const discordWebhookSchema = z
  .string()
  .trim()
  .regex(
    /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/,
    "repos.discordUrlInvalid",
  );

export const localeSchema = z.enum(["ar", "en"]);
export type Locale = z.infer<typeof localeSchema>;

export const themeSchema = z.enum(["dark", "light", "system"]);
export type Theme = z.infer<typeof themeSchema>;
