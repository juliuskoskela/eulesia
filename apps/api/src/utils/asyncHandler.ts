import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler to properly catch errors and pass them to Express error handling
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void | Response>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}
