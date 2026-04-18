import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import * as svc from "../services/simulation.service.js";

interface AuthReq extends Request { user?: { userId: string } }

export function simAuth(req: Request, _res: Response, next: NextFunction): void {
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

const initSchema = z.object({ scenarioId: z.string(), symbol: z.string(), totalCandles: z.number().int().positive(), startDate: z.string().optional(), endDate: z.string().optional() });
const controlSchema = z.object({ isPlaying: z.boolean().optional(), playSpeed: z.number().min(0.5).max(10).optional() });
const seekSchema = z.object({ index: z.number().int().min(0) });
const tradeSchema = z.object({ symbol: z.string(), type: z.enum(["BUY", "SELL"]), price: z.number().positive(), quantity: z.number().positive(), date: z.string() });

export async function init(req: Request, res: Response, next: NextFunction) {
  try {
    const p = initSchema.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: "Invalid payload" }); return; }
    res.json(await svc.initSession(uid(req as AuthReq), p.data));
  } catch (e) { next(e); }
}

export async function control(req: Request, res: Response, next: NextFunction) {
  try {
    const p = controlSchema.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: "Invalid payload" }); return; }
    res.json(await svc.updateSessionControl(uid(req as AuthReq), p.data));
  } catch (e) { next(e); }
}

export async function seek(req: Request, res: Response, next: NextFunction) {
  try {
    const p = seekSchema.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: "Invalid payload" }); return; }
    res.json(await svc.seekSession(uid(req as AuthReq), p.data.index));
  } catch (e) { next(e); }
}

export async function trade(req: Request, res: Response, next: NextFunction) {
  try {
    const p = tradeSchema.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: "Invalid payload" }); return; }
    res.status(201).json(await svc.executeTrade(uid(req as AuthReq), p.data));
  } catch (e) { next(e); }
}

export async function state(req: Request, res: Response, next: NextFunction) {
  try {
    const [session, portfolio, trades] = await Promise.all([
      svc.getSession(uid(req as AuthReq)),
      svc.getPortfolio(uid(req as AuthReq)),
      svc.getTrades(uid(req as AuthReq)),
    ]);
    res.json({ session, portfolio, trades });
  } catch (e) { next(e); }
}

export async function listTrades(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getTrades(uid(req as AuthReq))); } catch (e) { next(e); }
}
