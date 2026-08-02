import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { WEBHOOK_PATH } from "@/config/constants.js";
import { env, isProduction } from "@/config/env.js";
import { errorHandler, notFoundHandler } from "@/middleware/error.middleware.js";
import { webhookRouter } from "@/modules/webhook/webhook.routes.js";
import { apiRouter } from "@/routes.js";

export function createApp(): Express {
  const app = express();

  // Behind nginx in compose; without this req.ip is the proxy and the login
  // rate limiter would bucket every client together.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet({ contentSecurityPolicy: false }));

  /*
   * The webhook is mounted BEFORE express.json(). It needs the raw bytes for
   * HMAC verification and brings its own parser that captures them; letting the
   * global parser consume the stream first would make the signature
   * unverifiable.
   */
  app.use(WEBHOOK_PATH, webhookRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Same-origin in production (nginx proxies /api), so CORS only matters for
  // the Vite dev server on another port.
  if (!isProduction) {
    app.use(cors({ origin: env.PUBLIC_URL, credentials: true }));
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, data: { status: "up" } });
  });

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
