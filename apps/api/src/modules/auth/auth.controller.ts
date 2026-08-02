import type { Request, Response } from "express";
import type { LoginRequest } from "@commander/shared";
import { SESSION_COOKIE_NAME } from "@/config/constants.js";
import { isProduction } from "@/config/env.js";
import { ok } from "@/core/http/respond.js";
import { validated } from "@/middleware/validate.middleware.js";
import { authenticate, describeSession } from "./auth.service.js";

/**
 * `secure` is disabled outside production so the cookie survives plain-HTTP
 * local development; SameSite=Strict still blocks cross-site use either way.
 */
function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeSeconds * 1_000,
  };
}

export function getSession(req: Request, res: Response): void {
  const token = (req.cookies as Record<string, string | undefined>)[SESSION_COOKIE_NAME];
  ok(res, describeSession(token));
}

export function login(req: Request, res: Response): void {
  const { password } = validated<LoginRequest>(req);
  const session = authenticate(password);

  res.cookie(SESSION_COOKIE_NAME, session.token, cookieOptions(session.maxAgeSeconds));
  ok(res, { authenticated: true });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  ok(res, { authenticated: false });
}
