/**
 * Forwards rejected promises to Express's error pipeline.
 *
 * Express 4 does not await handlers, so a rejection inside an async route
 * becomes an unhandled rejection and the request hangs until it times out.
 * Wrapping every async route in this is what lets CONSTITUTION.md §6 forbid
 * try/catch inside controllers.
 */

import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncHandler<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler<Req extends Request = Request>(
  handler: AsyncHandler<Req>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req as Req, res, next)).catch(next);
  };
}
