import { redisClient } from "../config/redis";
import { PortfolioAccountModel } from "../models/PortfolioAccount";
import { PortfolioSnapshotModel } from "../models/PortfolioSnapshot";
import { PortfolioTradeModel } from "../models/PortfolioTrade";
import { PositionModel } from "../models/Position";
import { pnlCacheKey, positionsCacheKey, snapshotCacheKey, symbolPriceKey } from "./cacheKeys";

const DEFAULT_CASH_BALANCE = 100000;
const CACHE_TTL_SECONDS = 30;

type TradeInput = {
  userId: string;
  symbol: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  source: "api" | "kafka";
  eventId?: string;
  occurredAt?: Date;
};

type Allocation = {
  symbol: string;
  weight: number;
  marketValue: number;
};

type PnlSummary = {
  totalValue: number;
  dailyPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  investedValue: number;
  cashBalance: number;
};

async function getLatestPrice(symbol: string, fallbackPrice: number): Promise<number> {
  const cached = await redisClient.get(symbolPriceKey(symbol));
  if (!cached) return fallbackPrice;
  const value = Number(cached);
  if (!Number.isFinite(value) || value <= 0) return fallbackPrice;
  return value;
}

async function ensureAccount(userId: string) {
  const account = await PortfolioAccountModel.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, cashBalance: DEFAULT_CASH_BALANCE, currency: "USD", realizedPnl: 0 } },
    { upsert: true, new: true },
  );

  if (!account) {
    throw new Error("Failed to ensure portfolio account");
  }

  return account;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

async function buildSnapshot(userId: string): Promise<PnlSummary> {
  const account = await ensureAccount(userId);
  const openPositions = await PositionModel.find({ userId, status: "OPEN" }).lean();

  let investedValue = 0;
  let unrealizedPnl = 0;
  const allocationBase: Array<{ symbol: string; marketValue: number }> = [];

  for (const position of openPositions) {
    const currentPrice = await getLatestPrice(position.symbol, position.currentPrice || position.avgPrice);
    const marketValue = currentPrice * position.quantity;
    const positionUnrealized = (currentPrice - position.avgPrice) * position.quantity;

    investedValue += marketValue;
    unrealizedPnl += positionUnrealized;
    allocationBase.push({ symbol: position.symbol, marketValue });
  }

  const totalValue = account.cashBalance + investedValue;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const baselineSnapshot = await PortfolioSnapshotModel.findOne({
    userId,
    generatedAt: { $gte: dayStart },
  }).sort({ generatedAt: 1 }).lean() as { totalValue?: number } | null;

  const baselineValue = baselineSnapshot?.totalValue ?? totalValue;
  const dailyPnl = totalValue - baselineValue;

  const allocations: Allocation[] = allocationBase.map((item) => ({
    symbol: item.symbol,
    marketValue: round(item.marketValue),
    weight: totalValue > 0 ? round((item.marketValue / totalValue) * 100) : 0,
  }));

  await PortfolioSnapshotModel.create({
    userId,
    totalValue: round(totalValue),
    cashBalance: round(account.cashBalance),
    investedValue: round(investedValue),
    dailyPnl: round(dailyPnl),
    unrealizedPnl: round(unrealizedPnl),
    realizedPnl: round(account.realizedPnl),
    allocations,
    generatedAt: new Date(),
  });

  const snapshotPayload: PnlSummary = {
    totalValue: round(totalValue),
    dailyPnl: round(dailyPnl),
    unrealizedPnl: round(unrealizedPnl),
    realizedPnl: round(account.realizedPnl),
    investedValue: round(investedValue),
    cashBalance: round(account.cashBalance),
  };

  await Promise.all([
    redisClient.setex(snapshotCacheKey(userId), CACHE_TTL_SECONDS, JSON.stringify(snapshotPayload)),
    redisClient.setex(pnlCacheKey(userId), CACHE_TTL_SECONDS, JSON.stringify(snapshotPayload)),
  ]);

  return snapshotPayload;
}

async function getOrBuildSnapshot(userId: string): Promise<PnlSummary> {
  const cached = await redisClient.get(snapshotCacheKey(userId));
  if (cached) {
    return JSON.parse(cached) as PnlSummary;
  }
  return buildSnapshot(userId);
}

async function normalizePositionPrice(userId: string, symbol: string, fallbackPrice: number): Promise<number> {
  const price = await getLatestPrice(symbol, fallbackPrice);
  const position = await PositionModel.findOne({ userId, symbol, status: "OPEN" });

  const quantity = Number(position?.quantity ?? 0);
  const avgPrice = Number(position?.avgPrice ?? price);
  const marketValue = round(price * quantity);
  const unrealizedPnl = round((price - avgPrice) * quantity);

  await PositionModel.updateOne(
    { userId, symbol },
    {
      $set: {
        currentPrice: round(price),
        marketValue,
        unrealizedPnl,
      },
    },
  );
  return price;
}

export async function applyTrade(input: TradeInput): Promise<{ tradeId: string; snapshot: PnlSummary }> {
  if (!input.userId || !input.symbol) {
    throw new Error("userId and symbol are required");
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("quantity must be positive");
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("price must be positive");
  }

  const normalizedSymbol = input.symbol.toUpperCase();
  const account = await ensureAccount(input.userId);

  const existingPosition = await PositionModel.findOne({ userId: input.userId, symbol: normalizedSymbol });
  const total = round(input.quantity * input.price);
  let realizedPnl = 0;

  if (input.type === "BUY") {
    if (account.cashBalance < total) {
      throw new Error("INSUFFICIENT_CASH_BALANCE");
    }

    account.cashBalance = round(account.cashBalance - total);

    if (existingPosition && existingPosition.status === "OPEN") {
      const combinedQty = existingPosition.quantity + input.quantity;
      const nextAvg = ((existingPosition.avgPrice * existingPosition.quantity) + total) / combinedQty;
      existingPosition.quantity = round(combinedQty);
      existingPosition.avgPrice = round(nextAvg);
      existingPosition.currentPrice = round(input.price);
      existingPosition.marketValue = round(existingPosition.currentPrice * existingPosition.quantity);
      existingPosition.unrealizedPnl = round((existingPosition.currentPrice - existingPosition.avgPrice) * existingPosition.quantity);
      await existingPosition.save();
    } else {
      await PositionModel.findOneAndUpdate(
        { userId: input.userId, symbol: normalizedSymbol },
        {
          $set: {
            userId: input.userId,
            symbol: normalizedSymbol,
            quantity: round(input.quantity),
            avgPrice: round(input.price),
            currentPrice: round(input.price),
            marketValue: round(input.quantity * input.price),
            unrealizedPnl: 0,
            realizedPnl: 0,
            status: "OPEN",
            closedAt: null,
          },
        },
        { upsert: true, new: true },
      );
    }
  } else {
    if (!existingPosition || existingPosition.status !== "OPEN" || existingPosition.quantity < input.quantity) {
      throw new Error("INSUFFICIENT_POSITION_QUANTITY");
    }

    realizedPnl = round((input.price - existingPosition.avgPrice) * input.quantity);

    account.cashBalance = round(account.cashBalance + total);
    account.realizedPnl = round(account.realizedPnl + realizedPnl);

    existingPosition.quantity = round(existingPosition.quantity - input.quantity);
    existingPosition.realizedPnl = round((existingPosition.realizedPnl ?? 0) + realizedPnl);
    existingPosition.currentPrice = round(input.price);
    existingPosition.marketValue = round(existingPosition.currentPrice * existingPosition.quantity);
    existingPosition.unrealizedPnl = round((existingPosition.currentPrice - existingPosition.avgPrice) * existingPosition.quantity);

    if (existingPosition.quantity <= 0) {
      existingPosition.quantity = 0;
      existingPosition.marketValue = 0;
      existingPosition.unrealizedPnl = 0;
      existingPosition.status = "CLOSED";
      existingPosition.closedAt = new Date();
    }

    await existingPosition.save();
  }

  await account.save();
  await redisClient.setex(symbolPriceKey(normalizedSymbol), 180, String(round(input.price)));

  const trade = await PortfolioTradeModel.create({
    userId: input.userId,
    symbol: normalizedSymbol,
    type: input.type,
    quantity: round(input.quantity),
    price: round(input.price),
    total,
    realizedPnl,
    source: input.source,
    eventId: input.eventId,
    occurredAt: input.occurredAt ?? new Date(),
  });

  const snapshot = await buildSnapshot(input.userId);
  await redisClient.del(positionsCacheKey(input.userId));

  return {
    tradeId: String(trade._id),
    snapshot,
  };
}

export async function updatePrice(symbol: string, price: number): Promise<Array<{ userId: string; snapshot: PnlSummary }>> {
  if (!Number.isFinite(price) || price <= 0) return [];

  const normalizedSymbol = symbol.toUpperCase();
  await redisClient.setex(symbolPriceKey(normalizedSymbol), 180, String(round(price)));

  const impacted = await PositionModel.find({ symbol: normalizedSymbol, status: "OPEN" }, { userId: 1 }).lean();
  const uniqueUsers = Array.from(new Set(impacted.map((item) => item.userId)));
  const snapshots: Array<{ userId: string; snapshot: PnlSummary }> = [];

  for (const userId of uniqueUsers) {
    await normalizePositionPrice(userId, normalizedSymbol, price);
    const snapshot = await buildSnapshot(userId);
    await redisClient.del(positionsCacheKey(userId));
    snapshots.push({ userId, snapshot });
  }

  return snapshots;
}

export async function getPortfolio(userId: string) {
  const account = await ensureAccount(userId);
  const positions = await getPositions(userId, "OPEN");
  const snapshot = await getOrBuildSnapshot(userId);

  return {
    userId,
    currency: account.currency,
    positions,
    ...snapshot,
  };
}

export async function getPositions(userId: string, status?: "OPEN" | "CLOSED") {
  const cacheKey = positionsCacheKey(userId);
  if (!status) {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Array<Record<string, unknown>>;
    }
  }

  const query = status ? { userId, status } : { userId };
  const positions = await PositionModel.find(query).sort({ updatedAt: -1 }).lean();

  const normalized = positions.map((position) => ({
    symbol: position.symbol,
    status: position.status,
    quantity: round(position.quantity),
    avgPrice: round(position.avgPrice),
    currentPrice: round(position.currentPrice),
    marketValue: round(position.marketValue),
    unrealizedPnl: round(position.unrealizedPnl),
    realizedPnl: round(position.realizedPnl),
    updatedAt: position.updatedAt,
  }));

  if (!status) {
    await redisClient.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(normalized));
  }

  return normalized;
}

export async function getPnl(userId: string): Promise<PnlSummary> {
  const cached = await redisClient.get(pnlCacheKey(userId));
  if (cached) {
    return JSON.parse(cached) as PnlSummary;
  }
  return getOrBuildSnapshot(userId);
}

export async function getTradeHistory(userId: string) {
  const rows = await PortfolioTradeModel.find({ userId }).sort({ occurredAt: -1 }).limit(200).lean();
  return rows.map((row) => ({
    id: String(row._id),
    symbol: row.symbol,
    type: row.type,
    quantity: round(row.quantity),
    price: round(row.price),
    total: round(row.total),
    realizedPnl: round(row.realizedPnl),
    source: row.source,
    occurredAt: row.occurredAt,
  }));
}
