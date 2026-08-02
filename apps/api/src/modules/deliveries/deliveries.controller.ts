import type { Request, Response } from "express";
import type {
  DeliveryArchive,
  DeliveryQuery,
  DigestSendRequest,
  PreviewRequest,
  TestSendRequest,
} from "@commander/shared";
import { BadRequestError, NotFoundError } from "@/core/errors/app-error.js";
import { ok } from "@/core/http/respond.js";
import { validated } from "@/middleware/validate.middleware.js";
import { getRepository } from "@/modules/repositories/repositories.service.js";
import { enqueue } from "@/queue/outbox.service.js";
import { samplePush } from "@/queue/report.pipeline.js";
import {
  archiveDelivery,
  archiveMatching,
  getDelivery,
  listDeliveries,
  purgeArchived,
  restoreDelivery,
  retryDelivery,
} from "./deliveries.service.js";
import { runPreview } from "./preview.service.js";
import { sendDigestNow } from "@/modules/digest/digest.service.js";

function requireId(req: Request): string {
  const id = req.params.id;
  if (!id) throw new BadRequestError();
  return id;
}

export async function list(req: Request, res: Response): Promise<void> {
  ok(res, await listDeliveries(validated<DeliveryQuery>(req, "query")));
}

export async function read(req: Request, res: Response): Promise<void> {
  ok(res, await getDelivery(requireId(req)));
}

export async function retry(req: Request, res: Response): Promise<void> {
  ok(res, await retryDelivery(requireId(req)));
}

export async function archive(req: Request, res: Response): Promise<void> {
  ok(res, await archiveDelivery(requireId(req)));
}

export async function restore(req: Request, res: Response): Promise<void> {
  ok(res, await restoreDelivery(requireId(req)));
}

export async function archiveAll(req: Request, res: Response): Promise<void> {
  const count = await archiveMatching(validated<DeliveryArchive>(req));
  ok(res, { count });
}

export async function purge(_req: Request, res: Response): Promise<void> {
  ok(res, { count: await purgeArchived() });
}

/** Renders the full pipeline and stops short of Discord. Nothing leaves the process. */
export async function preview(req: Request, res: Response): Promise<void> {
  ok(res, await runPreview(validated<PreviewRequest>(req)));
}

/**
 * A real test send goes through the queue like any push, so it exercises the
 * exact delivery path — and takes no config from the body, which is what stops
 * a session holder using the server as a request proxy (§7).
 */
export async function testSend(req: Request, res: Response): Promise<void> {
  const { repositoryId } = validated<TestSendRequest>(req);
  const repository = await getRepository(repositoryId);
  if (!repository.enabled) throw new NotFoundError("repos.notFound");

  const login = repository.members[0]?.login ?? "octocat";
  const push = samplePush(repository.fullName, login);

  const branch = repository.branches[0]?.replace(/\*$/, "") || "main";
  push.branch = branch;
  push.ref = `refs/heads/${branch}`;

  const delivery = await enqueue({ occasion: { kind: "push", push }, repositoryId: repository.id });
  ok(res, { deliveryId: delivery.id });
}

/**
 * The weekly digest, now, for the window that is genuinely open. One service
 * call: the window arithmetic and the anchor stamp belong together and belong
 * there, not here.
 */
export async function sendDigest(req: Request, res: Response): Promise<void> {
  const { repositoryId } = validated<DigestSendRequest>(req);
  ok(res, await sendDigestNow(repositoryId));
}
