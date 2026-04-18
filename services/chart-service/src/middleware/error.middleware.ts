import type { NextFunction, Request, Response } from "express";

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const code = error instanceof Error && error.message.includes(":")
    ? error.message.split(":", 1)[0]
    : "INTERNAL_ERROR";

  res.status(500).json({
    ok: false,
    error: {
      code,
      message: error instanceof Error ? error.message : String(error),
    },
  });
}
