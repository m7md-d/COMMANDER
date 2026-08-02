import type { PreviewRequest, PreviewResult } from "@commander/shared";
import { NotFoundError } from "@/core/errors/app-error.js";
import { findByFullName } from "@/modules/repositories/repositories.service.js";
import { getDefaultPrompt, getPrompt } from "@/modules/prompts/prompts.service.js";
import { getSettings } from "@/modules/settings/settings.service.js";
import { composeReport, detectViolations, samplePush } from "@/queue/report.pipeline.js";
import { listMemberStats } from "@/modules/stats/stats.service.js";

/**
 * Runs the same composition the worker runs, against fabricated data, and never
 * touches Discord. `promptOverride` lets the panel preview unsaved edits — safe
 * precisely because the result goes back to the caller and nowhere else.
 */
export async function runPreview(request: PreviewRequest): Promise<PreviewResult> {
  const repository = await findByFullName(request.repositoryFullName);
  if (!repository) throw new NotFoundError("repos.notFound");

  const settings = await getSettings();
  const login = repository.members[0]?.login ?? "octocat";
  const push = samplePush(repository.fullName, login);

  const prompt =
    request.promptOverride ??
    (request.promptId ? await getPrompt(request.promptId) : await getDefaultPrompt());

  // Real history, fabricated push — the preview should show the continuity the
  // model actually gets, not a pristine record.
  const stats = await listMemberStats(repository.id);
  const record = stats.find((entry) => entry.login.toLowerCase() === login.toLowerCase());

  const violations = detectViolations(push, repository, settings);

  const composed = await composeReport({
    push,
    repository,
    settings,
    violations,
    // No credits either, and for the same reason as the reviews below: a credit
    // is measured against the stored tree, and the sample push touched nothing
    // in it. Inventing one would make every preview flatter the prompt.
    commendations: [],
    // The sample push cites shas that do not exist, so there is no code to
    // review; the preview shows the same "unavailable" line a real push gets
    // before its commits have been judged.
    reviews: [],
    history: {
      totalCommits: record?.totalCommits ?? 0,
      totalPushes: record?.totalPushes ?? 0,
      violationCounts: record?.violationCounts ?? {},
    },
    prompt,
  });

  return {
    reportText: composed.reportText,
    systemPrompt: composed.systemPrompt,
    userPrompt: composed.userPrompt,
    violations: composed.violations.map((hit) => ({ ruleId: hit.ruleId, detail: hit.detail })),
    llmOk: composed.llmOk,
    llmError: composed.llmError,
    model: composed.model,
  };
}
