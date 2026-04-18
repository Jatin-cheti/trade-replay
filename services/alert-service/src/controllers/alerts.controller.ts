import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AlertModel } from "../models/Alert.js";
import { registerAlert, deactivateAlert, getAlertCount } from "../services/alerts.service.js";

interface AuthReq extends Request { user?: { userId: string } }

export function alertAuth(req: Request, _res: Response, next: NextFunction): void {
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
  symbol: z.string().min(1).max(20).toUpperCase(),
  condition: z.enum(["price_above", "price_below", "price_cross_above", "price_cross_below", "percent_change_above", "percent_change_below"]),
  threshold: z.number(),
  message: z.string().max(200).optional(),
  cooldownSec: z.number().int().min(0).max(86400).optional().default(300),
  fireOnce: z.boolean().optional().default(false),
});

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = uid(req as AuthReq);
    const p = createSchema.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
    const doc = await AlertModel.create({ ...p.data, userId });
    registerAlert({
      id: doc._id.toString(), userId, symbol: doc.symbol,
      condition: doc.condition as "price_above", threshold: doc.threshold,
      message: doc.message ?? "", cooldownSec: doc.cooldownSec ?? 300,
      fireOnce: doc.fireOnce ?? false, active: true, lastTriggeredAt: 0,
    });
    res.status(201).json(doc);
  } catch (e) { next(e); }
}

export async function listAlerts(req: Request, res: Response, next: NextFunction) {
  try { res.json(await AlertModel.find({ userId: uid(req as AuthReq), active: true }).sort({ createdAt: -1 })); }
  catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = uid(req as AuthReq);
    const id = String(req.params.id);
    const doc = await AlertModel.findOneAndUpdate({ _id: id, userId }, { $set: { active: false } }, { new: true });
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    deactivateAlert(id);
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function alertStats(_req: Request, res: Response) {
  res.json(getAlertCount());
}
