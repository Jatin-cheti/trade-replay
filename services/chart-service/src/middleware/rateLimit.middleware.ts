import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

const buckets = new Map<string, { count: number; resetAt: number }>();

function bucketKey(req: Request): string {
  const symbol = String(req.query.symbol ?? req.body?.symbol ?? "_").toUpperCase();
  return `${req.ip}:${symbol}`;
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/health") {
    next();
    return;
  }

  const key = bucketKey(req);
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + env.RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (current.count >= env.RATE_LIMIT_MAX) {
    res.status(429).json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many requests for symbol" } });
    return;
  }

  current.count += 1;
  buckets.set(key, current);
  next();
}
