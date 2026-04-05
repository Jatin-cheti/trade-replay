import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, "NOT_FOUND", "Resource not found"));
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(500, "INTERNAL_ERROR", "Unexpected server error");

  logger.error("request_failed", {
    method: req.method,
    path: req.originalUrl,
    statusCode: appError.statusCode,
    errorCode: appError.errorCode,
    message: appError.message,
  });

  res.status(appError.statusCode).json({
    success: false,
    message: appError.message,
    errorCode: appError.errorCode,
  });
}
