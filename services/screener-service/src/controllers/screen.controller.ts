import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import * as svc from "../services/screen.service.js";

interface AuthReq extends Request { user?: { userId: string } }

function auth(req: Request, _res: Response, next: NextFunction): void {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) { res401(next); return; }
  try {
    const d = jwt.verify(h.slice(7), env.JWT_SECRET) as { userId: string };
    (req as AuthReq).user = { userId: d.userId };
    next();
  } catch { res401(next); }
}

function res401(next: NextFunction) { next(Object.assign(new Error("Unauthorized"), { statusCode: 401 })); }

function uid(req: AuthReq): string {
  if (!req.user?.userId) throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  return req.user.userId;
}

export const screenAuth = auth;

export async function listScreens(req: Request, res: Response, next: NextFunction) {
  try { res.json({ screens: await svc.listScreens(uid(req as AuthReq)) }); } catch (e) { next(e); }
}

export async function createScreen(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json({ screen: await svc.createScreen(uid(req as AuthReq), req.body) }); } catch (e) { next(e); }
}

export async function updateScreen(req: Request, res: Response, next: NextFunction) {
  try {
    const screen = await svc.updateScreen(uid(req as AuthReq), String(req.params.id), req.body);
    if (!screen) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ screen });
  } catch (e) { next(e); }
}

export async function deleteScreen(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.deleteScreen(uid(req as AuthReq), String(req.params.id));
    if (!result) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ deleted: true });
  } catch (e) { next(e); }
}

export async function copyScreen(req: Request, res: Response, next: NextFunction) {
  try {
    const screen = await svc.copyScreen(uid(req as AuthReq), String(req.params.id));
    if (!screen) { res.status(404).json({ error: "Not found" }); return; }
    res.status(201).json({ screen });
  } catch (e) { next(e); }
}
