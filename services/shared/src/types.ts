import { Request } from "express";

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
