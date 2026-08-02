import { Router } from "express";
import {
  deliveryArchiveSchema,
  deliveryQuerySchema,
  digestSendRequestSchema,
  previewRequestSchema,
  testSendRequestSchema,
} from "@commander/shared";
import { asyncHandler } from "@/core/http/async-handler.js";
import { validate } from "@/middleware/validate.middleware.js";
import {
  archive,
  archiveAll,
  list,
  preview,
  purge,
  read,
  restore,
  retry,
  sendDigest,
  testSend,
} from "./deliveries.controller.js";

export const deliveriesRouter: Router = Router();

deliveriesRouter.get("/", validate(deliveryQuerySchema, "query"), asyncHandler(list));
deliveriesRouter.post("/preview", validate(previewRequestSchema), asyncHandler(preview));
deliveriesRouter.post("/test", validate(testSendRequestSchema), asyncHandler(testSend));
deliveriesRouter.post("/digest", validate(digestSendRequestSchema), asyncHandler(sendDigest));

// Static /archive routes come before the /:id params, so "archive" is never
// matched as a delivery id.
deliveriesRouter.post("/archive", validate(deliveryArchiveSchema), asyncHandler(archiveAll));
deliveriesRouter.delete("/archive", asyncHandler(purge));

deliveriesRouter.get("/:id", asyncHandler(read));
deliveriesRouter.post("/:id/retry", asyncHandler(retry));
deliveriesRouter.post("/:id/archive", asyncHandler(archive));
deliveriesRouter.post("/:id/restore", asyncHandler(restore));
