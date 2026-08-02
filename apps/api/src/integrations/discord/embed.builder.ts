/**
 * Builds the Discord embed. Pure — the client does the sending.
 *
 * Discord rejects the whole request with a 400 when a field exceeds its limit,
 * so every string is clamped here rather than discovered at delivery time.
 */

import {
  t,
  type Commendation,
  type LocaleId,
  type NormalizedPush,
  type ViolationHit,
} from "@commander/shared";
import {
  DISCORD_DESCRIPTION_LIMIT,
  DISCORD_FIELD_VALUE_LIMIT,
  EMBED_COLOR_CLEAN,
  EMBED_COLOR_FLAGGED,
} from "@/config/constants.js";
import { praiseLabel, violationLabel } from "@/domain/report/prompt-builder.js";

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline: boolean }[];
  footer: { text: string };
  timestamp: string;
  url?: string;
  thumbnail?: { url: string };
}

function clamp(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** A bulleted field, or nothing at all — an empty list is left out rather than
 *  printed as a header with nothing under it. */
function listField<T>(input: {
  locale: LocaleId;
  key: "report.fieldViolations" | "report.fieldCommendations";
  entries: T[];
  label: (entry: T) => string;
}) {
  const { locale, key, entries, label } = input;
  if (entries.length === 0) return [];

  return [
    {
      name: t(locale, key),
      value: clamp(entries.map((entry) => `• ${label(entry)}`).join("\n"), DISCORD_FIELD_VALUE_LIMIT),
      inline: false,
    },
  ];
}

interface EmbedInput {
  locale: LocaleId;
  push: NormalizedPush;
  displayName: string;
  rank: string;
  violations: ViolationHit[];
  commendations: Commendation[];
  reportText: string;
}

/** The identity line and the two ledgers, in reading order. */
function buildFields(input: EmbedInput) {
  const { locale, push, displayName, rank, violations, commendations } = input;

  return [
    {
      name: t(locale, "report.fieldMember"),
      value: rank ? `${rank} ${displayName}` : displayName,
      inline: true,
    },
    { name: t(locale, "report.fieldBranch"), value: push.branch || "—", inline: true },
    { name: t(locale, "report.fieldCommits"), value: String(push.commits.length), inline: true },
    // Two fields, never one. A reader scans the violations list as the charge
    // sheet, and a credit sitting inside it reads as one more thing done wrong.
    ...listField({
      locale,
      key: "report.fieldViolations",
      entries: violations,
      label: (hit) => violationLabel(locale, hit),
    }),
    ...listField({
      locale,
      key: "report.fieldCommendations",
      entries: commendations,
      label: (entry) => praiseLabel(locale, entry),
    }),
  ];
}

export function buildEmbed(input: EmbedInput): DiscordEmbed {
  const { locale, push, violations, reportText } = input;

  const embed: DiscordEmbed = {
    title: `🎖️ ${t(locale, "report.embedTitle")} — ${push.repoFullName}`,
    description: clamp(reportText, DISCORD_DESCRIPTION_LIMIT),
    // Colour still follows the charges alone: a push that both broke and fixed
    // something is a flagged push, and tinting it clean would bury the finding.
    color: violations.length > 0 ? EMBED_COLOR_FLAGGED : EMBED_COLOR_CLEAN,
    fields: buildFields(input),
    footer: { text: t(locale, "report.footer") },
    timestamp: new Date().toISOString(),
  };

  if (push.compareUrl) embed.url = push.compareUrl;
  if (push.actorAvatarUrl) embed.thumbnail = { url: push.actorAvatarUrl };

  return embed;
}
