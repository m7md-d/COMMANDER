/**
 * Structured logging for the operator, not the user — the one place
 * CONSTITUTION.md §3 permits English prose.
 *
 * JSON lines in production so `docker compose logs` is machine-readable;
 * human-readable in development.
 */

import { isProduction } from "@/config/env.js";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = isProduction ? "info" : "debug";

type Fields = Record<string, unknown>;

/** Never let a logging failure take down the request that triggered it. */
function write(line: { level: Level; scope: string; message: string; fields?: Fields }): void {
  const { level, scope, message, fields } = line;
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;

  if (isProduction) {
    stream.write(
      `${JSON.stringify({ ts: new Date().toISOString(), level, scope, message, ...fields })}\n`,
    );
    return;
  }

  const suffix = fields && Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : "";
  stream.write(`${level.toUpperCase().padEnd(5)} [${scope}] ${message}${suffix}\n`);
}

export interface Logger {
  debug(message: string, fields?: Fields): void;
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
}

/** Scoped so every line says which module produced it. */
export function createLogger(scope: string): Logger {
  return {
    debug: (message, fields) => write({ level: "debug", scope, message, fields }),
    info: (message, fields) => write({ level: "info", scope, message, fields }),
    warn: (message, fields) => write({ level: "warn", scope, message, fields }),
    error: (message, fields) => write({ level: "error", scope, message, fields }),
  };
}

/** Turns an unknown catch value into something loggable without throwing. */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return error.stack ? { message: error.message, stack: error.stack } : { message: error.message };
  }
  return { message: String(error) };
}
