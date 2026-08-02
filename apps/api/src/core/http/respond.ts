/**
 * The only place a response body is shaped. Controllers call these and nothing
 * else, which is what keeps CONSTITUTION.md §6 ("one error shape") true.
 */

import type { Response } from "express";
import type { ApiFailure, ApiSuccess, FieldIssue } from "@commander/shared";

export function ok<T>(res: Response, data: T, status = 200): Response {
  const body: ApiSuccess<T> = { ok: true, data };
  return res.status(status).json(body);
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).end();
}

export function failure(
  res: Response,
  error: { status: number; i18nKey: string; details?: FieldIssue[] },
): Response {
  const body: ApiFailure = error.details
    ? { ok: false, error: error.i18nKey, details: error.details }
    : { ok: false, error: error.i18nKey };
  return res.status(error.status).json(body);
}
