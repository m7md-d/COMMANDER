/**
 * Captures the exact bytes of the webhook body.
 *
 * GitHub's HMAC covers the raw payload. Parsing to an object and re-serialising
 * produces different bytes — key order, whitespace, unicode escaping — and the
 * signature would never match. This is a correctness requirement, not a
 * preference, and it is why the webhook route uses its own body parser.
 */

import express from "express";
import type { Request } from "express";

declare module "express-serve-static-core" {
  interface Request {
    rawBody?: string;
  }
}

const MAX_WEBHOOK_BODY = "5mb";

export const webhookBodyParser = express.json({
  limit: MAX_WEBHOOK_BODY,
  verify: (req, _res, buffer) => {
    (req as Request).rawBody = buffer.toString("utf8");
  },
});

export function readRawBody(req: Request): string {
  return req.rawBody ?? "";
}
