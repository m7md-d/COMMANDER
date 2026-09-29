import { NotFoundError } from "@/core/errors/app-error.js";
import { getRepository } from "@/modules/repositories/repositories.service.js";
import { getSettings } from "@/modules/settings/settings.service.js";
import { classifyPush } from "@/domain/judgement/event.js";
import { enqueue } from "@/queue/outbox.service.js";
import { keptReport } from "@/queue/report.kept.js";
import { detectViolations, samplePush } from "@/queue/report.pipeline.js";

/**
 * The test send: the sample push, judged here the way the preview judges it,
 * and queued with that judgement kept on the row (0012). The worker then only
 * writes and sends it, through the same channel and persona as a real report.
 *
 * Queued bare, as it once was, the worker judged it like a real push: it asked
 * GitHub for commits that do not exist (a 422 for each of `aaaaaaa` and
 * `bbbbbbb`) and wrote them, with their charges, into the record against the
 * front's first member (docs/DEFECTS.md D-35). It takes no config from the
 * body, which is what stops a session holder using the server as a proxy (§7).
 */
export async function queueTestSend(repositoryId: string): Promise<{ deliveryId: string }> {
  const repository = await getRepository(repositoryId);
  if (!repository.enabled) throw new NotFoundError("repos.notFound");

  const settings = await getSettings();
  const push = samplePush(repository.fullName, repository.members[0]?.login ?? "octocat");
  const branch = repository.branches[0]?.replace(/\*$/, "") || "main";
  push.branch = branch;
  push.ref = `refs/heads/${branch}`;

  const judgement = keptReport({
    push,
    judgement: {
      event: { kind: classifyPush({ push, pull: { status: "unasked" } }), pull: null },
      mainLine: true,
      violations: detectViolations({ push, repository, settings }),
      commendations: [],
    },
    // A made-up push stands on no record: it cites none.
    history: { totalCommits: 0, totalPushes: 0, violationCounts: {} },
  });

  const delivery = await enqueue({ occasion: { kind: "push", push }, repositoryId: repository.id, judgement });
  return { deliveryId: delivery.id };
}
