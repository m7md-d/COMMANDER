/**
 * Filling a template with values. Pure (§2), and split from prompt-builder for
 * a real seam rather than for line count: that file decides *which facts* a
 * communiqué gets, this one decides only how they are put into the operator's
 * text. Neither needs to know what the other chose.
 */

import {
  t,
  PROJECT_CONTEXT_BLOCK,
  PROJECT_CONTEXT_VARIABLES,
  type LocaleId,
  type PromptValues,
} from "@commander/shared";

/**
 * The user prompt, with project context guaranteed. A template that asks for
 * none of the context variables predates them, so the block is prepended rather
 * than letting the model judge a repository it knows nothing about — see
 * PROJECT_CONTEXT_VARIABLES for why the stored text is never rewritten instead.
 */
export function renderUserPrompt(template: string, values: PromptValues): string {
  const rendered = renderTemplate(template, values);
  const asksForContext = PROJECT_CONTEXT_VARIABLES.some((name) =>
    template.includes(`{{${name}}}`),
  );

  const withContext = asksForContext
    ? rendered
    : `${renderTemplate(PROJECT_CONTEXT_BLOCK, values)}\n\n${rendered}`;

  return appendCommendations(withContext, template, values);
}

/**
 * Praise reaches the model even through a template written before praise
 * existed.
 *
 * Every stored prompt in every installation predates `{{commendations}}`, and
 * prompts are the operator's text to edit — never ours to rewrite. Appending
 * only when the template does not place the variable itself, and only when there
 * is something to append, means this costs exactly nothing on the pushes where
 * nobody earned anything, and cannot double up on a template that was updated.
 */
function appendCommendations(rendered: string, template: string, values: PromptValues): string {
  const block = String(values.commendations);
  if (!block || template.includes("{{commendations}}")) return rendered;
  return `${rendered}\n\n${block}`;
}

/** Unknown placeholders are left intact rather than blanked, so typos are visible. */
export function renderTemplate(template: string, values: PromptValues): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name as keyof PromptValues])
      : match,
  );
}

export function fallbackReport(locale: LocaleId, values: PromptValues): string {
  return t(locale, "report.fallback", {
    name: String(values.displayName),
    count: Number(values.commitCount),
    branch: String(values.branch),
  });
}
