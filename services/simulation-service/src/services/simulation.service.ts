import { SimulationSessionModel } from "../models/SimulationSession.js";
import { TradeModel } from "../models/Trade.js";
import { PortfolioModel } from "../models/Portfolio.js";

export async function initSession(userId: string, data: { scenarioId: string; symbol: string; totalCandles: number; startDate?: string; endDate?: string }) {
  return SimulationSessionModel.findOneAndUpdate(
    { userId },
    { $set: { ...data, currentIndex: 0, isPlaying: false, playSpeed: 1 } },
    { new: true, upsert: true },
  ).lean();
}

export async function getSession(userId: string) {
  return SimulationSessionModel.findOne({ userId }).lean();
}

export async function updateSessionControl(userId: string, update: { isPlaying?: boolean; playSpeed?: number }) {
  return SimulationSessionModel.findOneAndUpdate({ userId }, { $set: update }, { new: true }).lean();
}

export async function seekSession(userId: string, index: number) {
  return SimulationSessionModel.findOneAndUpdate({ userId }, { $set: { currentIndex: index, isPlaying: false } }, { new: true }).lean();
}

export async function executeTrade(userId: string, data: { symbol: string; type: "BUY" | "SELL"; price: number; quantity: number; date: string }) {
  const total = data.price * data.quantity;
  const trade = await TradeModel.create({ userId, ...data, total, realizedPnl: 0 });

  const portfolio = await PortfolioModel.findOne({ userId });
  if (!portfolio) return trade;

  if (data.type === "BUY") {
    portfolio.balance -= total;
    const existing = portfolio.holdings.find((h: { symbol: string }) => h.symbol === data.symbol);
    if (existing) {
      const newQty = existing.quantity + data.quantity;
      existing.avgPrice = (existing.avgPrice * existing.quantity + data.price * data.quantity) / newQty;
      existing.quantity = newQty;
    } else {
      portfolio.holdings.push({ symbol: data.symbol, quantity: data.quantity, avgPrice: data.price });
    }
  } else {
    portfolio.balance += total;
    const existing = portfolio.holdings.find((h: { symbol: string }) => h.symbol === data.symbol);
    if (existing) {
      existing.quantity -= data.quantity;
      if (existing.quantity <= 0) {
        portfolio.holdings = portfolio.holdings.filter((h: { symbol: string }) => h.symbol !== data.symbol);
      }
    }
  }

  await portfolio.save();
  return trade;
}

export async function getTrades(userId: string) {
  return TradeModel.find({ userId }).sort({ createdAt: -1 }).lean();
}

export async function getPortfolio(userId: string) {
  let doc = await PortfolioModel.findOne({ userId }).lean();
  if (!doc) doc = await PortfolioModel.create({ userId, balance: 100000, currency: "USD", holdings: [] });
  return doc;
}
