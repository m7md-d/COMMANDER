import { z } from "zod";
import { cuidSchema, repoFullNameSchema } from "./common.js";

export const promptInputSchema = z.object({
  name: z.string().trim().min(1, "prompt.nameRequired").max(80),
  system: z.string().trim().min(20, "prompt.systemTooShort").max(8_000),
  user: z.string().trim().min(10, "prompt.userTooShort").max(8_000),
});

export type PromptInput = z.infer<typeof promptInputSchema>;

export interface Prompt extends PromptInput {
  id: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A preview renders the full pipeline against fabricated data and stops short
 * of Discord. `promptOverride` lets the panel preview unsaved edits, which is
 * safe precisely because nothing leaves the process.
 */
export const previewRequestSchema = z.object({
  repositoryFullName: repoFullNameSchema,
  promptId: cuidSchema.optional(),
  promptOverride: promptInputSchema.optional(),
});

export type PreviewRequest = z.infer<typeof previewRequestSchema>;

export interface PreviewResult {
  reportText: string;
  systemPrompt: string;
  userPrompt: string;
  violations: { ruleId: string; detail: Record<string, string | number> }[];
  llmOk: boolean;
  llmError: string | null;
  model: string;
}

/**
 * A real test send. It deliberately takes no config from the body: a session
 * holder must not be able to make the server POST to an arbitrary URL.
 */
export const testSendRequestSchema = z.object({
  repositoryId: cuidSchema,
});

export type TestSendRequest = z.infer<typeof testSendRequestSchema>;

/**
 * A digest sent on demand. Same shape and same reason as the test send above —
 * the window comes from the stored schedule, never from the caller, so nobody
 * can ask the server to summarise a range of their choosing.
 */
export const digestSendRequestSchema = z.object({
  repositoryId: cuidSchema,
});

export type DigestSendRequest = z.infer<typeof digestSendRequestSchema>;
