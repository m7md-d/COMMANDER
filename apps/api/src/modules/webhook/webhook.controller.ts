import type { Request, Response } from "express";
import { GITHUB_EVENT_HEADER, GITHUB_SIGNATURE_HEADER } from "@/config/constants.js";
import { UnauthorizedError } from "@/core/errors/app-error.js";
import { createLogger } from "@/core/logger/logger.js";
import { readRawBody } from "@/middleware/raw-body.middleware.js";
import { findByFullName } from "@/modules/repositories/repositories.service.js";
import { enqueue } from "@/queue/outbox.service.js";
import { verifyGitHubSignature } from "./webhook.signature.js";
import { isBranchRef, normalizePush } from "./push.mapper.js";

const log = createLogger("webhook");

/**
 * Authenticate, persist, return 202. Nothing else.
 *
 * GitHub abandons a delivery after roughly 10 seconds and an LLM call alone can
 * exceed that, so the handler's only job is to get the push durably into the
 * outbox. Everything downstream is the worker's problem — and unlike the
 * Worker-era `waitUntil`, a failure there is now visible and retried.
 */
export async function receive(req: Request, res: Response): Promise<void> {
  const rawBody = readRawBody(req);
  const signature = req.header(GITHUB_SIGNATURE_HEADER);

  if (!verifyGitHubSignature(rawBody, signature)) {
    // Nothing from an unauthenticated body is recorded, not even the repo name.
    log.warn("rejected unsigned delivery", { ip: req.ip });
    throw new UnauthorizedError("error.unauthorized");
  }

  const event = req.header(GITHUB_EVENT_HEADER);

  if (event === "ping") {
    res.status(200).json({ ok: true, data: { pong: true } });
    return;
  }

  if (event !== "push") {
    res.status(202).json({ ok: true, data: { ignored: true } });
    return;
  }

  const push = normalizePush(req.body);

  // Tag deletions and creations arrive as pushes too.
  if (!isBranchRef(push.ref)) {
    res.status(202).json({ ok: true, data: { ignored: true } });
    return;
  }

  const repository = await findByFullName(push.repoFullName);

  // Unregistered repositories are still recorded: the panel showing
  // "repo_not_configured" is how an operator discovers a mis-wired webhook.
  const delivery = await enqueue({
    occasion: { kind: "push", push },
    repositoryId: repository?.id ?? null,
  });

  log.info("queued", { id: delivery.id, repo: push.repoFullName, branch: push.branch });
  res.status(202).json({ ok: true, data: { deliveryId: delivery.id } });
}
