/**
 * Parses and replaces the request part with the typed result, so controllers
 * receive validated data and never touch `req.body` raw.
 *
 * CONSTITUTION.md §2 forbids `any`: the generic carries the schema's output
 * type through to the handler.
 */

import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodSchema } from "zod";

type Part = "body" | "query" | "params";

export function validate<T>(schema: ZodSchema<T>, part: Part = "body"): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      next(result.error);
      return;
    }

    // Express 5 makes req.query a getter; assigning to a local copy keeps this
    // working across both major versions.
    Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true });
    next();
  };
}

/** Reads the validated part with its schema type restored. */
export function validated<T>(req: Request, part: Part = "body"): T {
  return req[part] as T;
}
