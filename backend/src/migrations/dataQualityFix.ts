/**
 * Data quality migration: deprioritize SEC filings and COINGECKO wrapper tokens.
 * Also boost canonical exchange symbols (NASDAQ/NYSE/NSE/BSE).
 *
 * Run: set -a; source /opt/tradereplay/.env; set +a; cd /opt/tradereplay/backend; node -e "require('./src/migrations/dataQualityFix')"
 * Or via tsx: npx tsx src/migrations/dataQualityFix.ts
 */
import mongoose from "mongoose";
import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";

// Wrapper token patterns: stockified crypto tokens (AAPL.D, MSFT.D, etc.)
const WRAPPER_TOKEN_REGEX = /\.(D|X)$/i;

// Canonical exchanges that indicate real listings
const REAL_EXCHANGES = new Set([
  "NASDAQ", "NYSE", "NYSEARCA", "NSE", "BSE", "LSE", "TSE", "HKEX",
  "SSE", "SZSE", "ASX", "TSX", "EURONEXT", "XETRA", "KRX", "SGX",
  "BINANCE", "COINBASE", "KRAKEN", "GLOBAL", "FOREX", "FX",
]);

async function run() {
  await mongoose.connect(MONGO_URI);
  logger.info("data_quality_fix_started", { uri: MONGO_URI.substring(0, 30) + "..." });

  // --- Phase 1: Deprioritize SEC filings (they're regulatory filings, not trading venues) ---
  const secResult = await SymbolModel.updateMany(
    { exchange: "SEC", source: "sec" },
    { $set: { priorityScore: -10 } },
  );
  logger.info("data_quality_sec_deprioritized", { matched: secResult.matchedCount, modified: secResult.modifiedCount });

  // --- Phase 2: Deprioritize COINGECKO wrapper tokens (MSFT.D, AAPL.D, TSLA, etc.) ---
  // These are tokenized stock derivatives on CoinGecko, not real stock listings
  const wrapperResult = await SymbolModel.updateMany(
    {
      exchange: "COINGECKO",
      symbol: { $regex: WRAPPER_TOKEN_REGEX },
    },
    { $set: { priorityScore: -15 } },
  );
  logger.info("data_quality_coingecko_wrappers_deprioritized", { matched: wrapperResult.matchedCount, modified: wrapperResult.modifiedCount });

  // Also deprioritize COINGECKO entries that duplicate real stock symbols
  // e.g., META@COINGECKO should be below META@NASDAQ
  const cryptoStockOverlap = await SymbolModel.aggregate([
    { $match: { exchange: "COINGECKO", type: "crypto" } },
    { $lookup: {
      from: "symbols",
      let: { sym: "$symbol" },
      pipeline: [
        { $match: {
          $expr: { $eq: ["$symbol", "$$sym"] },
          exchange: { $in: ["NASDAQ", "NYSE", "NSE", "BSE", "LSE"] },
          type: "stock",
        }},
        { $limit: 1 },
      ],
      as: "realListing",
    }},
    { $match: { realListing: { $ne: [] } } },
    { $project: { _id: 1, symbol: 1 } },
  ]);

  if (cryptoStockOverlap.length > 0) {
    const overlapIds = cryptoStockOverlap.map((doc: { _id: mongoose.Types.ObjectId }) => doc._id);
    const overlapResult = await SymbolModel.updateMany(
      { _id: { $in: overlapIds } },
      { $set: { priorityScore: -8 } },
    );
    logger.info("data_quality_coingecko_stock_overlap_deprioritized", {
      symbols: cryptoStockOverlap.map((d: { symbol: string }) => d.symbol).slice(0, 20).join(", "),
      matched: overlapResult.matchedCount,
      modified: overlapResult.modifiedCount,
    });
  }

  // --- Phase 3: Boost canonical exchange symbols ---
  // NASDAQ/NYSE stocks with priorityScore 0 should get a base boost
  const boostResult = await SymbolModel.updateMany(
    {
      exchange: { $in: ["NASDAQ", "NYSE"] },
      source: "nasdaq-trader",
      priorityScore: { $lte: 0 },
    },
    { $set: { priorityScore: 50 } },
  );
  logger.info("data_quality_us_stocks_boosted", { matched: boostResult.matchedCount, modified: boostResult.modifiedCount });

  // Boost NSE/BSE Indian stocks
  const indiaBoostResult = await SymbolModel.updateMany(
    {
      exchange: { $in: ["NSE", "BSE"] },
      priorityScore: { $lte: 0 },
    },
    { $set: { priorityScore: 40 } },
  );
  logger.info("data_quality_india_stocks_boosted", { matched: indiaBoostResult.matchedCount, modified: indiaBoostResult.modifiedCount });

  // Boost top crypto exchanges (Binance, Coinbase, Kraken)
  const cryptoBoostResult = await SymbolModel.updateMany(
    {
      exchange: { $in: ["BINANCE", "COINBASE", "KRAKEN"] },
      priorityScore: { $lte: 0 },
    },
    { $set: { priorityScore: 30 } },
  );
  logger.info("data_quality_crypto_boosted", { matched: cryptoBoostResult.matchedCount, modified: cryptoBoostResult.modifiedCount });

  // --- Phase 4: Set bluechip priority scores ---
  const bluechips: Record<string, { score: number; exchange: string }> = {
    AAPL: { score: 1200, exchange: "NASDAQ" },
    MSFT: { score: 1150, exchange: "NASDAQ" },
    GOOGL: { score: 1100, exchange: "NASDAQ" },
    AMZN: { score: 1080, exchange: "NASDAQ" },
    NVDA: { score: 1060, exchange: "NASDAQ" },
    META: { score: 1040, exchange: "NASDAQ" },
    TSLA: { score: 1020, exchange: "NASDAQ" },
    JPM: { score: 900, exchange: "NYSE" },
    V: { score: 880, exchange: "NYSE" },
    MA: { score: 860, exchange: "NYSE" },
    DIS: { score: 840, exchange: "NYSE" },
    BA: { score: 820, exchange: "NYSE" },
    NFLX: { score: 800, exchange: "NASDAQ" },
    SPY: { score: 950, exchange: "NYSE" },
    QQQ: { score: 930, exchange: "NASDAQ" },
    BTCUSDT: { score: 1000, exchange: "BINANCE" },
    ETHUSDT: { score: 900, exchange: "BINANCE" },
    RELIANCE: { score: 1000, exchange: "NSE" },
    TCS: { score: 950, exchange: "NSE" },
    HDFCBANK: { score: 920, exchange: "NSE" },
    INFY: { score: 900, exchange: "NSE" },
    EURUSD: { score: 800, exchange: "FOREX" },
    USDJPY: { score: 780, exchange: "FOREX" },
    GBPUSD: { score: 760, exchange: "FOREX" },
    NIFTY50: { score: 850, exchange: "NSE" },
    SENSEX: { score: 830, exchange: "BSE" },
    SPX: { score: 900, exchange: "SP" },
    NDX: { score: 880, exchange: "NASDAQ" },
  };

  for (const [symbol, { score, exchange }] of Object.entries(bluechips)) {
    // eslint-disable-next-line no-await-in-loop
    await SymbolModel.updateMany(
      { symbol, exchange },
      { $set: { priorityScore: score } },
    );
  }
  logger.info("data_quality_bluechips_boosted", { count: Object.keys(bluechips).length });

  // --- Summary ---
  const total = await SymbolModel.countDocuments();
  const negative = await SymbolModel.countDocuments({ priorityScore: { $lt: 0 } });
  const zero = await SymbolModel.countDocuments({ priorityScore: 0 });
  const positive = await SymbolModel.countDocuments({ priorityScore: { $gt: 0 } });
  logger.info("data_quality_fix_complete", {
    total,
    negative,
    zero,
    positive,
    percentPositive: ((positive / total) * 100).toFixed(1) + "%",
  });

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Data quality fix failed:", error);
  process.exit(1);
});
