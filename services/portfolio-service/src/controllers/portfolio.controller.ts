import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import * as svc from "../services/portfolio.service.js";

interface AuthReq extends Request { user?: { userId: string } }

export function portfolioAuth(req: Request, _res: Response, next: NextFunction): void {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) { next(Object.assign(new Error("Unauthorized"), { statusCode: 401 })); return; }
  try {
    const d = jwt.verify(h.slice(7), env.JWT_SECRET) as { userId: string };
    (req as AuthReq).user = { userId: d.userId };
    next();
  } catch { next(Object.assign(new Error("Invalid token"), { statusCode: 401 })); }
}

function uid(req: AuthReq): string {
  if (!req.user?.userId) throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  return req.user.userId;
}

const createSchema = z.object({
  name: z.string().min(2).max(80),
  baseCurrency: z.string().min(3).max(8).optional(),
  holdings: z.array(z.object({ symbol: z.string().min(1), quantity: z.number().positive(), avgPrice: z.number().positive() })).min(1),
});

export async function getCurrent(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.ensurePortfolio(uid(req as AuthReq))); } catch (e) { next(e); }
}

export async function listSaved(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.listSaved(uid(req as AuthReq))); } catch (e) { next(e); }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await svc.getSavedById(uid(req as AuthReq), String(req.params.portfolioId));
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    res.json(doc);
  } catch (e) { next(e); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const p = createSchema.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: "Invalid payload" }); return; }
    res.status(201).json(await svc.createSaved(uid(req as AuthReq), p.data));
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const p = createSchema.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: "Invalid payload" }); return; }
    const doc = await svc.updateSaved(uid(req as AuthReq), String(req.params.portfolioId), p.data);
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    res.json(doc);
  } catch (e) { next(e); }
}
