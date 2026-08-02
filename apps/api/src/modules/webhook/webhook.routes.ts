import { Router } from "express";
import { asyncHandler } from "@/core/http/async-handler.js";
import { webhookBodyParser } from "@/middleware/raw-body.middleware.js";
import { receive } from "./webhook.controller.js";

/**
 * Mounted before the global JSON parser and outside requireSession: GitHub
 * authenticates with an HMAC over the raw bytes, not a cookie.
 */
export const webhookRouter: Router = Router();

webhookRouter.post("/", webhookBodyParser, asyncHandler(receive));
