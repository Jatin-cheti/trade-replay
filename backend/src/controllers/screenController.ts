import { Request, Response, NextFunction } from "express";
import { ScreenModel } from "../models/Screen";
import { AuthenticatedRequest } from "../types/auth";
import { AppError } from "../utils/appError";
import mongoose from "mongoose";

type AuthReq = Request & AuthenticatedRequest;

export async function listScreens(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) { next(new AppError(401, "UNAUTHORIZED", "Auth required")); return; }

    const screens = await ScreenModel.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    res.json({ screens });
  } catch (err) {
    next(err);
  }
}

export async function createScreen(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) { next(new AppError(401, "UNAUTHORIZED", "Auth required")); return; }

    const { name, screenerType, tab, columns, filters, sort, order, query } = req.body;

    const screen = await ScreenModel.create({
      userId,
      name: typeof name === "string" ? name.slice(0, 100) : "Unnamed screen",
      screenerType: typeof screenerType === "string" ? screenerType : "stocks",
      tab: typeof tab === "string" ? tab : "overview",
      columns: Array.isArray(columns) ? columns.slice(0, 50) : [],
      filters: filters && typeof filters === "object" ? filters : {},
      sort: typeof sort === "string" ? sort : "marketCap",
      order: order === "asc" ? "asc" : "desc",
      query: typeof query === "string" ? query.slice(0, 200) : "",
    });

    res.status(201).json({ screen });
  } catch (err) {
    next(err);
  }
}

export async function updateScreen(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) { next(new AppError(401, "UNAUTHORIZED", "Auth required")); return; }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      next(new AppError(400, "INVALID_ID", "Invalid screen ID"));
      return;
    }

    const update: Record<string, unknown> = {};
    const { name, screenerType, tab, columns, filters, sort, order, query } = req.body;

    if (typeof name === "string") update.name = name.slice(0, 100);
    if (typeof screenerType === "string") update.screenerType = screenerType;
    if (typeof tab === "string") update.tab = tab;
    if (Array.isArray(columns)) update.columns = columns.slice(0, 50);
    if (filters && typeof filters === "object") update.filters = filters;
    if (typeof sort === "string") update.sort = sort;
    if (order === "asc" || order === "desc") update.order = order;
    if (typeof query === "string") update.query = query.slice(0, 200);

    const screen = await ScreenModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { new: true },
    ).lean();

    if (!screen) {
      next(new AppError(404, "NOT_FOUND", "Screen not found"));
      return;
    }

    res.json({ screen });
  } catch (err) {
    next(err);
  }
}

export async function deleteScreen(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) { next(new AppError(401, "UNAUTHORIZED", "Auth required")); return; }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      next(new AppError(400, "INVALID_ID", "Invalid screen ID"));
      return;
    }

    const result = await ScreenModel.findOneAndDelete({ _id: id, userId });
    if (!result) {
      next(new AppError(404, "NOT_FOUND", "Screen not found"));
      return;
    }

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function copyScreen(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) { next(new AppError(401, "UNAUTHORIZED", "Auth required")); return; }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      next(new AppError(400, "INVALID_ID", "Invalid screen ID"));
      return;
    }

    const original = await ScreenModel.findOne({ _id: id, userId }).lean();
    if (!original) {
      next(new AppError(404, "NOT_FOUND", "Screen not found"));
      return;
    }

    const copy = await ScreenModel.create({
      userId,
      name: `${original.name} (copy)`,
      screenerType: original.screenerType,
      tab: original.tab,
      columns: original.columns,
      filters: original.filters,
      sort: original.sort,
      order: original.order,
      query: original.query,
    });

    res.status(201).json({ screen: copy });
  } catch (err) {
    next(err);
  }
}
