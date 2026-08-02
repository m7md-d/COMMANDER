import { Router } from "express";
import rateLimit from "express-rate-limit";
import { loginRequestSchema } from "@commander/shared";
import { LOGIN_RATE_LIMIT } from "@/config/constants.js";
import { validate } from "@/middleware/validate.middleware.js";
import { getSession, login, logout } from "./auth.controller.js";

/**
 * The panel URL is reachable by anyone who guesses it, and one password is the
 * only gate — so the login route is the one place that needs a rate limit.
 */
const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT.windowMs,
  max: LOGIN_RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "error.rateLimited" },
});

export const authRouter: Router = Router();

authRouter.get("/session", getSession);
authRouter.post("/login", loginLimiter, validate(loginRequestSchema), login);
authRouter.post("/logout", logout);
