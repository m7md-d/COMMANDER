import { defaultSettings, settingsSchema, type Settings, type SettingsUpdate } from "@commander/shared";
import { SETTINGS_ROW_ID } from "@/config/constants.js";
import { env } from "@/config/env.js";
import { prisma } from "@/db/prisma.js";
import { createLogger } from "@/core/logger/logger.js";

const log = createLogger("settings");

/**
 * Settings are one JSON row rather than a column per field: they are read as a
 * unit, written as a unit, and adding a knob should not require a migration.
 * The zod schema is what gives that JSON its type safety back.
 */

function fallback(): Settings {
  return defaultSettings(env.OPENROUTER_MODEL, env.DEFAULT_LOCALE);
}

/**
 * A row written before a field existed is missing it, so stored values are
 * layered over the defaults rather than trusted wholesale.
 */
function reconcile(stored: unknown): Settings {
  const merged = { ...fallback(), ...(typeof stored === "object" && stored ? stored : {}) };
  const parsed = settingsSchema.safeParse(merged);

  if (parsed.success) return parsed.data;

  log.warn("stored settings failed validation, using defaults", {
    issues: parsed.error.issues.map((issue) => issue.path.join(".")),
  });
  return fallback();
}

export async function getSettings(): Promise<Settings> {
  const row = await prisma.setting.findUnique({ where: { id: SETTINGS_ROW_ID } });
  return reconcile(row?.data);
}

export async function updateSettings(patch: SettingsUpdate): Promise<Settings> {
  const current = await getSettings();
  const next = settingsSchema.parse({ ...current, ...patch });

  await prisma.setting.upsert({
    where: { id: SETTINGS_ROW_ID },
    create: { id: SETTINGS_ROW_ID, data: next },
    update: { data: next },
  });

  return next;
}

/** Called once at boot so the row exists before the first read. */
export async function ensureSettingsRow(): Promise<Settings> {
  const existing = await prisma.setting.findUnique({ where: { id: SETTINGS_ROW_ID } });
  if (existing) return reconcile(existing.data);

  const initial = fallback();
  await prisma.setting.create({ data: { id: SETTINGS_ROW_ID, data: initial } });
  log.info("initialised settings row");
  return initial;
}
