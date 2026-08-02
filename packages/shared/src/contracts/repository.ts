import { z } from "zod";
import { checkMapSchema } from "./check.js";
import { RULE_IDS, type RuleConfigMap } from "../domain/violations.js";
import { DEFAULT_PROJECT_STAGE, PROJECT_STAGES } from "../domain/project.js";
import { watchersSchema } from "../domain/watcher.js";
import { DEFAULT_SCHEDULE } from "../domain/schedule.js";
import { cuidSchema, discordWebhookSchema, repoFullNameSchema } from "./common.js";

export const memberInputSchema = z.object({
  login: z.string().trim().min(1, "member.loginRequired").max(64),
  displayName: z.string().trim().max(80).default(""),
  /** Filled by the repository scan; an operator never types this. */
  avatarUrl: z.string().trim().max(400).url().or(z.literal("")).default(""),
  rank: z.string().trim().max(40).default(""),
  note: z.string().trim().max(300).default(""),
});

export type MemberInput = z.infer<typeof memberInputSchema>;

export interface Member extends MemberInput {
  id: string;
  repositoryId: string;
}

/** A trailing `*` is the only wildcard; anything richer invites surprises. */
export const branchPatternSchema = z
  .string()
  .trim()
  .min(1, "repos.branchEmpty")
  .max(120)
  .regex(/^[^\s]+$/, "repos.branchInvalid");

const ruleConfigSchema = z
  .object({
    enabled: z.boolean(),
    threshold: z.number().int().min(1).max(10_000).optional(),
    minLength: z.number().int().min(1).max(200).optional(),
    words: z.array(z.string().trim().min(1).max(40)).max(100).optional(),
    startHour: z.number().int().min(0).max(23).optional(),
    endHour: z.number().int().min(0).max(23).optional(),
    days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  })
  .strict();

export const rulesSchema = z.record(z.enum(RULE_IDS), ruleConfigSchema);

/**
 * When this front's weekly digest goes out.
 *
 * A JSON column for the same reason as `rules` and `watchers`: the shape will
 * grow — a second periodic report, a fortnightly cadence — and a knob should not
 * cost a migration. Validated on read, so a hand-edited row degrades to the
 * shipped default rather than failing the whole repository.
 */
export const scheduleConfigSchema = z
  .object({
    enabled: z.boolean().default(DEFAULT_SCHEDULE.enabled),
    dayOfWeek: z.number().int().min(0).max(6).default(DEFAULT_SCHEDULE.dayOfWeek),
    hour: z.number().int().min(0).max(23).default(DEFAULT_SCHEDULE.hour),
  })
  .strict();

/** Keyed by report kind. Only the weekly digest exists today; the map is what
 *  lets a second periodic report arrive without touching the column. */
export const schedulesSchema = z
  .object({ weekly_digest: scheduleConfigSchema.default(DEFAULT_SCHEDULE) })
  .strict()
  .default({ weekly_digest: DEFAULT_SCHEDULE });

export type SchedulesConfig = z.infer<typeof schedulesSchema>;

export const repositoryInputSchema = z.object({
  fullName: repoFullNameSchema,
  enabled: z.boolean().default(true),
  /** Empty means every branch — an explicit product decision, not an oversight. */
  branches: z.array(branchPatternSchema).max(50).default([]),
  discordWebhookUrl: z.union([discordWebhookSchema, z.literal("")]).default(""),
  model: z.string().trim().max(120).default(""),
  promptId: cuidSchema.nullable().default(null),
  silentWhenClean: z.boolean().default(false),
  /** One line telling the model what this project *is*, so its commentary lands
   *  on your project rather than on a generic repository. */
  projectBrief: z.string().trim().max(400).default(""),
  /** Decides what the model treats as expected work rather than as a lapse. */
  projectStage: z.enum(PROJECT_STAGES).default(DEFAULT_PROJECT_STAGE),
  /// Numeric id from the GitHub App installation. Empty disables enrichment.
  githubInstallationId: z.string().trim().regex(/^\d*$/, "repos.installationInvalid").default(""),
  rules: rulesSchema,
  /** A shared set of check limits to inherit, or null for the shipped defaults. */
  checkTemplateId: cuidSchema.nullable().default(null),
  /** This front's own overrides, layered over the template field by field. */
  checks: checkMapSchema.default({}),
  /** Ordered: the first pattern that matches a branch governs it. */
  watchers: watchersSchema,
  /** When the periodic reports go out, in the operator's own timezone. */
  schedules: schedulesSchema,
  members: z.array(memberInputSchema).max(200).default([]),
});

export type RepositoryInput = z.infer<typeof repositoryInputSchema>;

export const repositoryUpdateSchema = repositoryInputSchema.partial();
export type RepositoryUpdate = z.infer<typeof repositoryUpdateSchema>;

/**
 * What the API returns. Note `rules` is the COMPLETE map, not the partial the
 * input schema accepts: stored rules are always layered over defaults on read,
 * so a consumer never has to handle a missing rule.
 */
export interface Repository extends Omit<RepositoryInput, "members" | "rules"> {
  id: string;
  rules: RuleConfigMap;
  members: Member[];
  /** ISO timestamp of the last reconnaissance pass; null means never scanned. */
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepositorySummary {
  id: string;
  fullName: string;
  enabled: boolean;
  branches: string[];
  memberCount: number;
}
