/** Values referenced in more than one module. Anything used once stays local. */

export const SESSION_COOKIE_NAME = "commander_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export const WEBHOOK_PATH = "/api/webhook";

/** GitHub headers the webhook depends on. */
export const GITHUB_SIGNATURE_HEADER = "x-hub-signature-256";
export const GITHUB_EVENT_HEADER = "x-github-event";
export const GITHUB_DELIVERY_HEADER = "x-github-delivery";

/**
 * GitHub abandons a webhook delivery at roughly 10s. The handler must persist
 * and return well inside that, which is why processing is an outbox job.
 */
export const WEBHOOK_RESPONSE_BUDGET_MS = 2_000;

/** A claimed job older than this is assumed orphaned by a crashed worker. */
export const JOB_LOCK_TIMEOUT_MS = 5 * 60 * 1_000;

/**
 * The reconciler looks back at most this far when recovering pushes missed
 * during downtime. It bounds catch-up so a long outage does not replay a long
 * backlog of reports; anything older is treated as water under the bridge.
 */
export const RECONCILE_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1_000;

/**
 * How many file rows one tree response may carry.
 *
 * The chart is built in the browser from a flat list, so the whole snapshot
 * travels at once. Past this the payload stops being worth its weight and the
 * response says so — a capped view is honest; a silently halved one is not.
 */
export const TREE_RESPONSE_LIMIT = 4_000;

/**
 * How many unmeasured blobs one pass may fetch.
 *
 * Measuring costs one request per blob we have never seen, so a first sweep of a
 * large project is bounded rather than run to completion: what is not measured
 * this pass is measured on the next. Slow and honest beats a rate-limit ban and
 * a half-built record.
 */
export const MEASURE_BATCH_PUSH = 40;
export const MEASURE_BATCH_SWEEP = 60;

/** A blob larger than this is left unmeasured rather than pulled into memory.
 *  Source files are not megabytes; anything that big is generated. */
export const MEASURE_MAX_BYTES = 400_000;

export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
/** The public model catalogue. No API key required; read-only. */
export const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
export const OPENROUTER_TIMEOUT_MS = 60_000;
export const DISCORD_TIMEOUT_MS = 15_000;

/** Discord embed limits. Exceeding them is a 400, so we clamp first. */
export const DISCORD_DESCRIPTION_LIMIT = 4_096;
export const DISCORD_FIELD_VALUE_LIMIT = 1_024;

export const EMBED_COLOR_CLEAN = 0x3fa66a;
export const EMBED_COLOR_FLAGGED = 0xc0453b;

/** The settings row is a singleton; the id is pinned so it cannot multiply. */
export const SETTINGS_ROW_ID = "singleton";

export const LOGIN_RATE_LIMIT = {
  windowMs: 15 * 60 * 1_000,
  max: 10,
} as const;
