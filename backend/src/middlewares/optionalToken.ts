import { NextFunction, Request, Response } from "express";
import { verifyJwt } from "../utils/jwt";
import { AuthenticatedRequest } from "../types/auth";

/** Like verifyToken but never rejects — attaches user if token is valid. */
export function optionalToken(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = verifyJwt(token);
      (req as Request & AuthenticatedRequest).user = { userId: decoded.userId, email: decoded.email };
    } catch { /* ignore invalid tokens */ }
  }
  next();
}