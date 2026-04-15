import { parse } from "csv-parse/sync";
import { SimulationEngine } from "./simulationEngine";
import { loadCandlesForSimulation } from "./marketData";
import { computePortfolioValue, ensurePortfolio, listTrades, setCurrency, writeThroughPortfolioCache } from "./portfolioService";
import { PortfolioModel } from "../models/Portfolio";
import { SavedPortfolioModel } from "../models/SavedPortfolio";
import { SimulationSessionModel } from "../models/SimulationSession";
import { TradeModel } from "../models/Trade";
import { CandleData, Currency, Holding } from "../types/shared";
import { InitPayload, TradeInput } from "../types/service";
import { cacheSession, getCachedSession } from "./sessionCacheService";
import { producePortfolioUpdate, produceTradeExecute, produceTradeResult } from "../kafka/eventProducers";
import { invalidateSymbolCaches } from "./cacheInvalidation.service";
import { incrementUserUsage } from "./symbol.service";

function mapTrades(rows: Awaited<ReturnType<typeof listTrades>>) {
  return rows.map((trade: Awaited<ReturnType<typeof listTrades>>[number]) => ({
    id: String(trade._id),
    symbol: trade.symbol,
    type: trade.type,
    price: trade.price,
    quantity: trade.quantity,
    total: trade.total,
    date: trade.date,
    realizedPnl: trade.realizedPnl,
    timestamp: new Date(trade.createdAt).valueOf(),
  }));
}

function currentBySymbol(candles: CandleData[], symbol: string, index: number): Record<string, CandleData | null> {
  return { [symbol]: candles[index] ?? candles[candles.length - 1] ?? null };
}

export class SimulationService {
  constructor(private engine: SimulationEngine) {}

  async init(userId: string, payload: InitPayload) {
    if (payload.portfolioId) {
      const savedPortfolio = await SavedPortfolioModel.findOne({ _id: payload.portfolioId, userId });
      if (!savedPortfolio) {
        throw new Error("PORTFOLIO_NOT_FOUND");
      }

      await PortfolioModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            holdings: savedPortfolio.holdings,
            currency: savedPortfolio.baseCurrency,
          },
          $setOnInsert: { userId, balance: 100000 },
        },
        { upsert: true },
      );
    }

    const market = await loadCandlesForSimulation(payload);
    if (!market.candles.length) throw new Error("NO_CANDLES");

    void incrementUserUsage([payload.symbol]).catch(() => {});

    const session = this.engine.upsertSession({
      userId,
      scenarioId: payload.scenarioId,
      symbol: payload.symbol,
      candles: market.candles,
    });

    await SimulationSessionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          scenarioId: payload.scenarioId,
          symbol: payload.symbol,
          currentIndex: session.currentIndex,
          totalCandles: session.candles.length,
          isPlaying: session.isPlaying,
          playSpeed: session.playSpeed,
          startDate: payload.startDate,
          endDate: payload.endDate,
        },
      },
      { upsert: true },
    );

    await cacheSession(userId, {
      scenarioId: payload.scenarioId,
      symbol: payload.symbol,
      currentIndex: session.currentIndex,
      totalCandles: session.candles.length,
      isPlaying: session.isPlaying,
      playSpeed: session.playSpeed,
    });

    const portfolio = await ensurePortfolio(userId);
    const trades = mapTrades(await listTrades(userId));

    return {
      source: market.source,
      simulation: {
        scenarioId: payload.scenarioId,
        symbol: payload.symbol,
        candles: session.candles,
        totalCandles: session.candles.length,
        currentIndex: session.currentIndex,
        currentCandle: session.candles[session.currentIndex],
        isPlaying: session.isPlaying,
        playSpeed: session.playSpeed,
      },
      portfolio,
      trades,
    };
  }

  async control(userId: string, action: "play" | "pause" | "step-forward" | "step-backward", speed?: number) {
    const session = this.engine.getSession(userId);
    if (!session) throw new Error("SIM_NOT_INITIALIZED");

    switch (action) {
      case "play":
        this.engine.play(userId, speed ?? session.playSpeed);
        break;
      case "pause":
        this.engine.pause(userId);
        break;
      case "step-forward":
        this.engine.pause(userId);
        this.engine.step(userId, 1);
        break;
      case "step-backward":
        this.engine.pause(userId);
        this.engine.step(userId, -1);
        break;
      default:
        break;
    }

    const updated = this.engine.getSession(userId);
    if (updated) {
      await SimulationSessionModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            currentIndex: updated.currentIndex,
            isPlaying: updated.isPlaying,
            playSpeed: updated.playSpeed,
            totalCandles: updated.candles.length,
            scenarioId: updated.scenarioId,
            symbol: updated.symbol,
          },
        },
      );

      await cacheSession(userId, {
        scenarioId: updated.scenarioId,
        symbol: updated.symbol,
        currentIndex: updated.currentIndex,
        totalCandles: updated.candles.length,
        isPlaying: updated.isPlaying,
        playSpeed: updated.playSpeed,
      });
    }

    return {
      currentIndex: updated?.currentIndex,
      isPlaying: updated?.isPlaying,
      playSpeed: updated?.playSpeed,
    };
  }

  async seek(userId: string, index: number) {
    const session = this.engine.setIndex(userId, index);
    if (!session) throw new Error("SIM_NOT_INITIALIZED");

    await SimulationSessionModel.findOneAndUpdate(
      { userId },
      { $set: { currentIndex: session.currentIndex, isPlaying: session.isPlaying } },
    );

    await cacheSession(userId, {
      scenarioId: session.scenarioId,
      symbol: session.symbol,
      currentIndex: session.currentIndex,
      totalCandles: session.candles.length,
      isPlaying: session.isPlaying,
      playSpeed: session.playSpeed,
    });

    return { currentIndex: session.currentIndex };
  }

  async executeTrade(userId: string, input: TradeInput) {
    const session = this.engine.getSession(userId);
    if (!session) throw new Error("SIM_NOT_INITIALIZED");

    const candle = session.candles[session.currentIndex];
    if (!candle) throw new Error("NO_CANDLE");

    const portfolioDoc = await PortfolioModel.findOne({ userId });
    if (!portfolioDoc) throw new Error("NO_PORTFOLIO");

    const price = candle.close;
    const quantity = input.quantity;
    const total = price * quantity;

    produceTradeExecute({
      userId,
      symbol: session.symbol,
      type: input.type,
      quantity,
      price,
      total,
    });

    const holdings = portfolioDoc.holdings as unknown as Holding[];

    let realizedPnl = 0;

    if (input.type === "BUY") {
      if (portfolioDoc.balance < total) throw new Error("INSUFFICIENT_BALANCE");
      portfolioDoc.balance -= total;

      const existing = holdings.find((holding) => holding.symbol === session.symbol);
      if (existing) {
        const combinedQty = existing.quantity + quantity;
        existing.avgPrice = (existing.avgPrice * existing.quantity + total) / combinedQty;
        existing.quantity = combinedQty;
      } else {
        portfolioDoc.holdings.push({ symbol: session.symbol, quantity, avgPrice: price } as Holding);
      }
    } else {
      const existing = holdings.find((holding) => holding.symbol === session.symbol);
      if (!existing || existing.quantity < quantity) throw new Error("INSUFFICIENT_HOLDINGS");

      realizedPnl = (price - existing.avgPrice) * quantity;
      portfolioDoc.balance += total;
      existing.quantity -= quantity;
      if (existing.quantity <= 0) {
        portfolioDoc.holdings = holdings.filter((holding) => holding.symbol !== session.symbol) as typeof portfolioDoc.holdings;
      }
    }

    await portfolioDoc.save();

    const trade = await TradeModel.create({
      userId,
      symbol: session.symbol,
      type: input.type,
      price,
      quantity,
      total,
      date: candle.time,
      realizedPnl,
    });

    const portfolio = {
      balance: portfolioDoc.balance,
      holdings: portfolioDoc.holdings,
      currency: portfolioDoc.currency,
      totalValue: computePortfolioValue(
        portfolioDoc.balance,
        portfolioDoc.holdings as Holding[],
        currentBySymbol(session.candles, session.symbol, session.currentIndex),
      ),
    };

    const tradePayload = {
      id: String(trade._id),
      symbol: trade.symbol,
      type: trade.type,
      price: trade.price,
      quantity: trade.quantity,
      total: trade.total,
      date: trade.date,
      realizedPnl: trade.realizedPnl,
      timestamp: new Date(trade.createdAt).valueOf(),
    };

    this.engine.emitTrade(userId, tradePayload);
    this.engine.emitPortfolio(userId, portfolio);

    await writeThroughPortfolioCache(userId, {
      balance: portfolio.balance,
      holdings: portfolio.holdings,
      currency: portfolio.currency,
    });
    await invalidateSymbolCaches(session.symbol);

    produceTradeResult({
      userId,
      tradeId: String(trade._id),
      symbol: trade.symbol,
      type: trade.type,
      quantity: trade.quantity,
      price: trade.price,
      total: trade.total,
      realizedPnl: trade.realizedPnl,
      success: true,
    });

    producePortfolioUpdate({
      userId,
      balance: portfolio.balance,
      holdingsCount: portfolio.holdings.length,
      action: "trade",
    });

    return { trade: tradePayload, portfolio };
  }

  async updateCurrency(userId: string, currency: Currency) {
    const updated = (await setCurrency(userId, currency)) as { currency?: Currency } | null;
    const portfolio = await ensurePortfolio(userId);
    await writeThroughPortfolioCache(userId, portfolio);
    producePortfolioUpdate({
      userId,
      balance: portfolio.balance,
      holdingsCount: portfolio.holdings.length,
      action: "currency_change",
    });
    return { currency: updated?.currency ?? currency };
  }

  async importPortfolioCsv(userId: string, csvRaw: string) {
    const records = parse(csvRaw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Array<{ symbol: string; quantity: string; avgPrice: string }>;

    const holdings = records
      .map((record) => ({
        symbol: record.symbol,
        quantity: Number(record.quantity),
        avgPrice: Number(record.avgPrice),
      }))
      .filter((holding) => holding.symbol && holding.quantity > 0 && holding.avgPrice > 0);

    const updated = (await PortfolioModel.findOneAndUpdate(
      { userId },
      { $set: { holdings } },
      { upsert: true, new: true },
    ).lean()) as { holdings?: Holding[]; balance?: number; currency?: Currency } | null;

    await writeThroughPortfolioCache(userId, {
      holdings: updated?.holdings ?? [],
      balance: updated?.balance ?? 100000,
      currency: updated?.currency ?? "USD",
    });

    producePortfolioUpdate({
      userId,
      balance: updated?.balance ?? 100000,
      holdingsCount: (updated?.holdings ?? []).length,
      action: "import",
    });

    return {
      holdings: updated?.holdings ?? [],
      balance: updated?.balance ?? 100000,
      currency: updated?.currency ?? "USD",
    };
  }

  async getState(userId: string) {
    const cached = await getCachedSession<Record<string, unknown>>(userId);
    const session = cached ?? (await SimulationSessionModel.findOne({ userId }).lean());
    const portfolio = await ensurePortfolio(userId);
    const trades = mapTrades(await listTrades(userId));
    return { session, portfolio, trades };
  }

  async getTrades(userId: string) {
    return mapTrades(await listTrades(userId));
  }

  async getPortfolio(userId: string) {
    return ensurePortfolio(userId);
  }
}
