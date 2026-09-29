import type { Request, Response } from "express";
import type {
  DeliveryArchive,
  DeliveryQuery,
  DigestSendRequest,
  PreviewRequest,
  TestSendRequest,
} from "@commander/shared";
import { BadRequestError } from "@/core/errors/app-error.js";
import { ok } from "@/core/http/respond.js";
import { validated } from "@/middleware/validate.middleware.js";
import {
  archiveDelivery,
  archiveMatching,
  getDelivery,
  listDeliveries,
  purgeArchived,
  restoreDelivery,
  resendDelivery,
} from "./deliveries.service.js";
import { runPreview } from "./preview.service.js";
import { queueTestSend } from "./test-send.service.js";
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

export async function resend(req: Request, res: Response): Promise<void> {
  ok(res, await resendDelivery(requireId(req)));
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

/** A real test send, through the queue and the channel — see `queueTestSend`. */
export async function testSend(req: Request, res: Response): Promise<void> {
  const { repositoryId } = validated<TestSendRequest>(req);
  ok(res, await queueTestSend(repositoryId));
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
