import { PortfolioModel } from "../models/Portfolio.js";
import { SavedPortfolioModel } from "../models/SavedPortfolio.js";

export async function ensurePortfolio(userId: string) {
  let doc = await PortfolioModel.findOne({ userId }).lean();
  if (!doc) doc = await PortfolioModel.create({ userId, balance: 100000, currency: "USD", holdings: [] });
  return doc;
}

export async function listSaved(userId: string) {
  return SavedPortfolioModel.find({ userId }).sort({ createdAt: -1 }).lean();
}

export async function getSavedById(userId: string, id: string) {
  return SavedPortfolioModel.findOne({ _id: id, userId }).lean();
}

export async function createSaved(userId: string, data: { name: string; baseCurrency?: string; holdings: { symbol: string; quantity: number; avgPrice: number }[] }) {
  return SavedPortfolioModel.create({ userId, name: data.name, baseCurrency: data.baseCurrency || "USD", holdings: data.holdings });
}

export async function updateSaved(userId: string, id: string, data: { name: string; baseCurrency?: string; holdings: { symbol: string; quantity: number; avgPrice: number }[] }) {
  return SavedPortfolioModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: { name: data.name, baseCurrency: data.baseCurrency || "USD", holdings: data.holdings } },
    { new: true },
  ).lean();
}
