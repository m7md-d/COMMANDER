import { z } from "zod";

export const loginRequestSchema = z.object({
  password: z.string().min(1, "auth.passwordRequired"),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export interface SessionState {
  authenticated: boolean;
  /** False when DASHBOARD_PASSWORD was never set — the panel shows setup help. */
  configured: boolean;
}

/**
 * Presence only. CONSTITUTION.md §7: no secret value ever leaves the API, so
 * the panel can show a checklist without ever holding a credential.
 */
export interface SecretStatus {
  DASHBOARD_PASSWORD: boolean;
  SESSION_SECRET: boolean;
  GITHUB_WEBHOOK_SECRET: boolean;
  OPENROUTER_API_KEY: boolean;
  DISCORD_WEBHOOK_URL: boolean;
  GITHUB_APP_ID: boolean;
  GITHUB_APP_PRIVATE_KEY: boolean;
}
