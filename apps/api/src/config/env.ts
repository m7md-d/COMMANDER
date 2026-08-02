/**
 * CONSTITUTION.md §7: the process refuses to start on bad configuration.
 *
 * A missing SESSION_SECRET discovered at boot is a five-second fix. The same
 * mistake discovered when the first user tries to log in is an outage.
 */

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),

  DATABASE_URL: z.string().min(1),

  /** Where the browser reaches the panel; drives CORS and the displayed webhook URL. */
  PUBLIC_URL: z.string().url().default("http://localhost:8080"),

  DASHBOARD_PASSWORD: z.string().min(1),
  /** 32 bytes hex. Short secrets make cookie forgery cheaper. */
  SESSION_SECRET: z.string().min(32),
  GITHUB_WEBHOOK_SECRET: z.string().min(16),

  /** Optional: absence degrades reports to a fallback sentence, it does not crash. */
  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_MODEL: z.string().default("google/gemma-4-26b-a4b-it:free"),
  DISCORD_WEBHOOK_URL: z.string().default(""),

  /**
   * GitHub App credentials. Optional: without them the dossier still works from
   * webhook data alone, but loses line counts and cannot quote the repository's
   * own constitution.
   */
  GITHUB_APP_ID: z.string().default(""),
  /** PEM with literal \n escapes, or the PEM base64-encoded. */
  GITHUB_APP_PRIVATE_KEY: z.string().default(""),

  DEFAULT_LOCALE: z.enum(["ar", "en"]).default("ar"),

  /** How often the outbox worker polls for claimable jobs. */
  QUEUE_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).max(300_000).default(5_000),
  QUEUE_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(5),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    // Written directly rather than through the logger: the logger itself may
    // depend on config, and this must be readable in a container's first lines.
    process.stderr.write(`\nInvalid environment configuration:\n${issues}\n\n`);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** Presence checklist for the panel. Values never leave the process (§7). */
export function secretStatus() {
  return {
    DASHBOARD_PASSWORD: env.DASHBOARD_PASSWORD.length > 0,
    SESSION_SECRET: env.SESSION_SECRET.length > 0,
    GITHUB_WEBHOOK_SECRET: env.GITHUB_WEBHOOK_SECRET.length > 0,
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY.length > 0,
    DISCORD_WEBHOOK_URL: env.DISCORD_WEBHOOK_URL.length > 0,
    GITHUB_APP_ID: env.GITHUB_APP_ID.length > 0,
    GITHUB_APP_PRIVATE_KEY: env.GITHUB_APP_PRIVATE_KEY.length > 0,
  };
}
