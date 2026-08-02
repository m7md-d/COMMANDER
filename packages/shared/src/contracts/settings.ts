import { z } from "zod";
import { localeSchema, themeSchema } from "./common.js";

export const settingsSchema = z.object({
  /** Panel chrome language. */
  locale: localeSchema,
  /** Language of the violation labels handed to the model. Independent of the above. */
  reportLocale: localeSchema,
  theme: themeSchema,

  model: z.string().trim().min(1, "settings.modelRequired").max(120),
  temperature: z.number().min(0, "settings.temperatureRange").max(2, "settings.temperatureRange"),
  maxTokens: z.number().int().min(64, "settings.maxTokensRange").max(4_000, "settings.maxTokensRange"),
  maxWords: z.number().int().min(20, "settings.maxWordsRange").max(600, "settings.maxWordsRange"),

  /**
   * Fixed offset, no DST. The night and weekend rules use it. Teams in a DST
   * region should expect a one-hour drift for part of the year — a documented
   * trade-off against timezone-database weight.
   */
  timezoneOffset: z
    .number()
    .int()
    .min(-12, "settings.timezoneRange")
    .max(14, "settings.timezoneRange"),

  /** Wraps and truncates attacker-controlled commit text before it reaches the model. */
  injectionGuard: z.boolean(),
  quoteMaxLength: z.number().int().min(40).max(2_000),

  deliveryRetentionDays: z.number().int().min(1).max(365),
  /** Still ingests and records webhooks; sends nothing. */
  paused: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const settingsUpdateSchema = settingsSchema.partial();
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export function defaultSettings(model: string, locale: "ar" | "en" = "ar"): Settings {
  return {
    locale,
    reportLocale: locale,
    theme: "dark",
    model,
    temperature: 0.9,
    maxTokens: 500,
    maxWords: 120,
    timezoneOffset: 3,
    injectionGuard: true,
    quoteMaxLength: 160,
    deliveryRetentionDays: 30,
    paused: false,
  };
}
