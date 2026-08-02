/**
 * CONSTITUTION.md §6: expected failures are classes carrying an HTTP status and
 * an i18n key. They never carry a sentence — the panel decides the wording.
 */

import type { FieldIssue } from "@commander/shared";

export class AppError extends Error {
  readonly statusCode: number;
  readonly i18nKey: string;
  readonly details: FieldIssue[] | undefined;

  constructor(statusCode: number, i18nKey: string, details?: FieldIssue[]) {
    // `message` is for logs and stack traces only; it is never sent to a client.
    super(i18nKey);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.i18nKey = i18nKey;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(i18nKey = "error.badRequest", details?: FieldIssue[]) {
    super(400, i18nKey, details);
  }
}

export class ValidationError extends AppError {
  constructor(details: FieldIssue[]) {
    super(422, "error.validation", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(i18nKey = "error.unauthorized") {
    super(401, i18nKey);
  }
}

export class ForbiddenError extends AppError {
  constructor(i18nKey = "error.forbidden") {
    super(403, i18nKey);
  }
}

export class NotFoundError extends AppError {
  constructor(i18nKey = "error.notFound") {
    super(404, i18nKey);
  }
}

export class ConflictError extends AppError {
  constructor(i18nKey: string) {
    super(409, i18nKey);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
