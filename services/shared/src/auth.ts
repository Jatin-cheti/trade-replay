import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "./appError.js";
import type { AuthenticatedRequest } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

export function verifyToken(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new AppError(401, "MISSING_TOKEN", "Missing token"));
    return;
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    (req as AuthenticatedRequest).user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch {
    next(new AppError(401, "INVALID_TOKEN", "Invalid token"));
  }
}

export function optionalToken(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      (req as AuthenticatedRequest).user = { userId: decoded.userId, email: decoded.email };
    } catch {}
  }
  next();
}
