/**
 * Gate for every panel route. The webhook does NOT pass through this — it
 * authenticates with an HMAC signature instead, because GitHub has no cookie.
 */

import type { RequestHandler } from "express";
import { SESSION_COOKIE_NAME } from "@/config/constants.js";
import { UnauthorizedError } from "@/core/errors/app-error.js";
import { verifySession } from "@/core/crypto/session-token.js";

export const requireSession: RequestHandler = (req, _res, next) => {
  const token = (req.cookies as Record<string, string | undefined>)[SESSION_COOKIE_NAME];

  if (!verifySession(token)) {
    next(new UnauthorizedError("error.unauthorized"));
    return;
  }

  next();
};
