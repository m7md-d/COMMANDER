/**
 * The single exit point for every failure. CONSTITUTION.md §6: controllers hold
 * no try/catch because everything they throw lands here.
 */

import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import type { FieldIssue } from "@commander/shared";
import { isAppError } from "@/core/errors/app-error.js";
import { failure } from "@/core/http/respond.js";
import { createLogger, describeError } from "@/core/logger/logger.js";
import { isProduction } from "@/config/env.js";

const log = createLogger("http");

function zodToIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    // zod messages in this codebase are i18n keys, set at schema definition.
    code: issue.message,
  }));
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  failure(res, { status: 404, i18nKey: "error.notFound" });
};

/**
 * The four parameters are not ours to reduce (CONSTITUTION.md §4). Express
 * identifies an error handler by `fn.length === 4` and by nothing else, so
 * dropping the unused `_next` silently demotes this to ordinary middleware and
 * every thrown error stops being handled at all. The arity is the registration.
 */
// eslint-disable-next-line max-params -- Express detects error handlers by arity; see above.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) return;

  if (isAppError(error)) {
    // Expected outcomes are not incidents; log at debug so they do not drown
    // real failures in the container log.
    log.debug("handled error", { path: req.path, key: error.i18nKey, status: error.statusCode });
    failure(res, { status: error.statusCode, i18nKey: error.i18nKey, details: error.details });
    return;
  }

  if (error instanceof ZodError) {
    failure(res, { status: 422, i18nKey: "error.validation", details: zodToIssues(error) });
    return;
  }

  // Anything reaching here is a bug. Log it fully; tell the client nothing.
  log.error("unhandled error", {
    path: req.path,
    method: req.method,
    ...describeError(error),
  });
  failure(res, { status: 500, i18nKey: isProduction ? "error.serverError" : "error.unknown" });
};
