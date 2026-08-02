/**
 * Process entry point: boot, serve, and shut down cleanly.
 *
 * Graceful shutdown matters here more than in a plain CRUD service — a SIGTERM
 * mid-delivery would otherwise leave a row stuck in `processing` until the lock
 * timeout expires.
 */

import type { Server } from "node:http";
import { env } from "@/config/env.js";
import { createLogger, describeError } from "@/core/logger/logger.js";
import { connectDatabase, disconnectDatabase } from "@/db/prisma.js";
import { ensureDefaultPrompt } from "@/modules/prompts/prompts.service.js";
import { ensureSettingsRow } from "@/modules/settings/settings.service.js";
import { startWorker, stopWorker } from "@/queue/worker.js";
import { createApp } from "@/app.js";

const log = createLogger("main");

async function bootstrap(): Promise<Server> {
  await connectDatabase();

  // Idempotent seeds so a fresh database is usable without a manual step.
  await ensureSettingsRow();
  await ensureDefaultPrompt();

  const server = createApp().listen(env.API_PORT, () => {
    log.info("listening", { port: env.API_PORT, env: env.NODE_ENV });
  });

  startWorker();
  return server;
}

function registerShutdown(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info("shutting down", { signal });

    server.close(() => {
      void (async () => {
        await stopWorker();
        await disconnectDatabase();
        process.exit(0);
      })();
    });

    // Do not hang forever on a stuck connection.
    setTimeout(() => {
      log.error("forced exit after timeout");
      process.exit(1);
    }, 45_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // An unhandled rejection means invariant broken somewhere; log loudly rather
  // than letting Node's default terminate silently.
  process.on("unhandledRejection", (reason) => {
    log.error("unhandled rejection", describeError(reason));
  });
}

bootstrap()
  .then(registerShutdown)
  .catch((error: unknown) => {
    log.error("boot failed", describeError(error));
    process.exit(1);
  });
