import type { AuthenticatedRequest } from "./types.js";
import { AppError } from "./appError.js";

export function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user?.userId) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  return req.user.userId;
}
