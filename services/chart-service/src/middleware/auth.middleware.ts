import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!env.CHART_SERVICE_AUTH_ENABLED || req.path === "/health") {
    next();
    return;
  }

  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7).trim()
    : "";
  const internal = typeof req.headers["x-internal-token"] === "string"
    ? req.headers["x-internal-token"]
    : "";
  const token = bearer || internal;

  if (!token) {
    res.status(401).json({ ok: false, error: { code: "MISSING_TOKEN", message: "Missing internal token" } });
    return;
  }

  if (token !== env.CHART_SERVICE_AUTH_TOKEN) {
    res.status(403).json({ ok: false, error: { code: "INVALID_TOKEN", message: "Invalid internal token" } });
    return;
  }

  next();
}
