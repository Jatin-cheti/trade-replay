import { ScreenModel } from "../models/Screen.js";
import mongoose from "mongoose";

export async function listScreens(userId: string) {
  return ScreenModel.find({ userId }).sort({ updatedAt: -1 }).limit(50).lean();
}

export async function createScreen(userId: string, body: Record<string, unknown>) {
  return ScreenModel.create({
    userId,
    name: typeof body.name === "string" ? (body.name as string).slice(0, 100) : "Unnamed screen",
    screenerType: typeof body.screenerType === "string" ? body.screenerType : "stocks",
    tab: typeof body.tab === "string" ? body.tab : "overview",
    columns: Array.isArray(body.columns) ? (body.columns as string[]).slice(0, 50) : [],
    filters: body.filters && typeof body.filters === "object" ? body.filters : {},
    sort: typeof body.sort === "string" ? body.sort : "marketCap",
    order: body.order === "asc" ? "asc" : "desc",
    query: typeof body.query === "string" ? (body.query as string).slice(0, 200) : "",
  });
}

export async function updateScreen(userId: string, id: string, body: Record<string, unknown>) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = (body.name as string).slice(0, 100);
  if (typeof body.screenerType === "string") update.screenerType = body.screenerType;
  if (typeof body.tab === "string") update.tab = body.tab;
  if (Array.isArray(body.columns)) update.columns = (body.columns as string[]).slice(0, 50);
  if (body.filters && typeof body.filters === "object") update.filters = body.filters;
  if (typeof body.sort === "string") update.sort = body.sort;
  if (body.order === "asc" || body.order === "desc") update.order = body.order;
  if (typeof body.query === "string") update.query = (body.query as string).slice(0, 200);
  return ScreenModel.findOneAndUpdate({ _id: id, userId }, { $set: update }, { new: true }).lean();
}

export async function deleteScreen(userId: string, id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return ScreenModel.findOneAndDelete({ _id: id, userId });
}

export async function copyScreen(userId: string, id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const original = await ScreenModel.findOne({ _id: id, userId }).lean() as Record<string, unknown> | null;
  if (!original) return null;
  return ScreenModel.create({
    userId,
    name: `${String(original.name)} (copy)`,
    screenerType: original.screenerType,
    tab: original.tab,
    columns: original.columns,
    filters: original.filters,
    sort: original.sort,
    order: original.order,
    query: original.query,
  });
}
