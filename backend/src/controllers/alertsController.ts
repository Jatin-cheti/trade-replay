import { NextFunction, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../types/auth";
import { AlertModel } from "../models/Alert";
import { registerAlert, deactivateAlert, getAlertCount } from "../services/alertsEngine.service";
import { AppError } from "../utils/appError";
import { requireUserId } from "../utils/request";

const createAlertSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  condition: z.enum(["price_above","price_below","price_cross_above","price_cross_below","percent_change_above","percent_change_below"]),
  threshold: z.number(),
  message: z.string().max(200).optional(),
  cooldownSec: z.number().int().min(0).max(86400).optional().default(300),
  fireOnce: z.boolean().optional().default(false),
});

export const alertsController = {
  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = requireUserId(req);
    const parsed = createAlertSchema.safeParse(req.body);
    if (!parsed.success) { next(new AppError(400, "INVALID_ALERT", parsed.error.message)); return; }
    const doc = await AlertModel.create({ ...parsed.data, userId });
    registerAlert({
      id: doc._id.toString(),
      userId,
      symbol: doc.symbol,
      condition: doc.condition as any,
      threshold: doc.threshold,
      message: doc.message,
      cooldownSec: doc.cooldownSec,
      fireOnce: doc.fireOnce,
      active: true,
      lastTriggeredAt: 0,
      createdAt: doc.createdAt as Date,
    });
    res.status(201).json(doc);
  },

  list: async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const alerts = await AlertModel.find({ userId, active: true }).sort({ createdAt: -1 });
    res.json(alerts);
  },

  remove: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = requireUserId(req);
    const id = String(req.params.id);
    const doc = await AlertModel.findOneAndUpdate({ _id: id, userId }, { $set: { active: false } }, { new: true });
    if (!doc) { next(new AppError(404, "ALERT_NOT_FOUND", "Alert not found")); return; }
    deactivateAlert(id);
    res.json({ ok: true });
  },

  stats: async (_req: AuthenticatedRequest, res: Response) => {
    res.json(getAlertCount());
  },
};
