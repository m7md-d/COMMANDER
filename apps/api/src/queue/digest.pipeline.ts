/**
 * Turning a counted week into a communiqué.
 *
 * Deliberately its own pipeline rather than a push forced into a costume. A
 * digest has no branch, no actor and no commits of its own, and the honest way
 * to write one is not to invent them — `report.pipeline.ts` would need a fake
 * push to start, and a fake push in the record is exactly the kind of lie this
 * codebase refuses elsewhere.
 *
 * What it *does* share is everything that matters: the front's own persona, the
 * same model call, the same embed vocabulary, and the same outbox row.
 */

import {
  rankMovers,
  t,
  type DigestFacts,
  type DigestTrigger,
  type LocaleId,
  type ViolationId,
} from "@commander/shared";
import { EMBED_COLOR_CLEAN, EMBED_COLOR_FLAGGED } from "@/config/constants.js";
import type { DiscordEmbed } from "@/integrations/discord/embed.builder.js";
import { SUGGESTION_LIMIT } from "./assessment.pipeline.js";

/** How many members each list names. Beyond this it stops being a report. */
const NAMED = 5;

function line(locale: LocaleId, facts: DigestFacts): string {
  return t(locale, "digest.totals", {
    pushes: facts.pushes,
    commits: facts.commits,
    violations: facts.violations,
    commendations: facts.commendations,
  });
}

/**
 * The facts as text for the model, in the language the reports are written in.
 *
 * Rendered from the dictionary rather than assembled from English fragments in
 * code — a prompt is user-facing text like any other (§3), and the model reads
 * it in the same language it must answer in.
 */
export function renderDigestFacts(locale: LocaleId, facts: DigestFacts): string {
  if (facts.quiet) return t(locale, "digest.quiet");

  const { improved, slipped } = rankMovers(facts.members);
  const blocks = [line(locale, facts)];

  const movers = (label: string, members: typeof improved) =>
    members.length === 0
      ? []
      : [
          t(locale, label),
          ...members.slice(0, NAMED).map((member) =>
            t(locale, "digest.moverLine", {
              name: member.displayName,
              violations: member.violations,
              delta: member.delta > 0 ? `+${member.delta}` : String(member.delta),
            }),
          ),
        ];

  blocks.push(
    ...movers("digest.movers", improved),
    ...movers("digest.slipped", slipped),
    ...credited(locale, facts),
    ...codeState(locale, facts),
  );

  return blocks.join("\n");
}

/**
 * Who earned something, on a different basis from the movers above: a mover
 * committed fewer offences than last week, which anyone can achieve by pushing
 * less. A credit was measured on the code itself.
 */
function credited(locale: LocaleId, facts: DigestFacts): string[] {
  const earners = facts.members.filter((member) => member.commendations > 0);
  if (earners.length === 0) return [];

  return [
    t(locale, "digest.credited"),
    ...earners.slice(0, NAMED).map((member) =>
      t(locale, "digest.creditLine", {
        name: member.displayName,
        commendations: member.commendations,
      }),
    ),
  ];
}

/** How the code stands, and which way it moved since the last digest. */
function codeState(locale: LocaleId, facts: DigestFacts): string[] {
  if (facts.code.length === 0) return [];

  return [
    t(locale, "digest.codeState"),
    ...facts.code.map((state) => {
      const label = t(locale, `rule.${state.metric}.label`);
      return state.change === null
        ? t(locale, "digest.codeLineFirst", { label, over: state.over })
        : t(locale, "digest.codeLine", {
            label,
            over: state.over,
            change: state.change > 0 ? `+${state.change}` : String(state.change),
          });
    }),
  ];
}

/**
 * The prompt, with the assessment appended only when there is evidence for one.
 *
 * An empty assessment block adds no instruction at all rather than an
 * instruction to assess nothing — a model told every week that it has no
 * evidence still writes a paragraph, and that paragraph is exactly the invented
 * advice this section exists to avoid.
 */
export function renderDigestPrompt(input: {
  locale: LocaleId;
  facts: DigestFacts;
  trigger: DigestTrigger;
  assessment?: string;
}): string {
  const { locale, facts, trigger, assessment = "" } = input;
  // Two prompts, because they ask for two different things. The weekly one
  // closes a period; the interim one reports a period still running, and a model
  // told to "summarise the week" about four days of it will round them up to one.
  const base = t(locale, trigger === "manual" ? "digest.promptInterim" : "digest.prompt", {
    window: t(locale, "digest.window", {
      since: facts.since.slice(0, 10),
      until: facts.until.slice(0, 10),
    }),
    facts: renderDigestFacts(locale, facts),
  });

  if (!assessment) return base;

  const instruction = t(locale, "assess.instruction", {
    heading: t(locale, "assess.heading"),
    limit: SUGGESTION_LIMIT,
  });

  return `${base}\n\n${assessment}\n\n${instruction}`;
}

export function buildDigestEmbed(input: {
  locale: LocaleId;
  repoFullName: string;
  facts: DigestFacts;
  reportText: string;
  trigger: DigestTrigger;
}): DiscordEmbed {
  const { locale, repoFullName, facts, reportText, trigger } = input;

  return {
    // Named for what it is. Two reports that look identical arriving in one
    // channel on one day teaches the channel to ignore both.
    title: `${t(locale, trigger === "manual" ? "digest.titleInterim" : "digest.title")} · ${repoFullName}`,
    description: reportText,
    color: facts.violations > 0 ? EMBED_COLOR_FLAGGED : EMBED_COLOR_CLEAN,
    fields: [
      {
        name: t(locale, "digest.window", {
          since: facts.since.slice(0, 10),
          until: facts.until.slice(0, 10),
        }),
        value: line(locale, facts),
        inline: false,
      },
      ...facts.byRule.slice(0, 3).map((entry) => ({
        name: t(locale, `rule.${entry.ruleId as ViolationId}.label`),
        value: String(entry.count),
        inline: true,
      })),
    ],
    footer: { text: t(locale, "app.name") },
    timestamp: facts.until,
  };
}
