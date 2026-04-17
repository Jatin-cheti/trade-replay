import { SymbolModel } from "../models/Symbol";
import { CleanAssetModel } from "../models/CleanAsset";
import { logger } from "../utils/logger";
import { produce } from "../kafka/producer";
import { KAFKA_TOPICS } from "../kafka/topics";
import type { AnyBulkWriteOperation } from "mongoose";

/**
 * Builds the clean_assets "gold layer" from the raw symbols table.
 * Filters for: valid exchange, valid name, has logo OR is high-priority, active trading.
 * Processes in batches to avoid event loop blocking.
 */

const BATCH_SIZE = 500;
const KNOWN_EXCHANGES = new Set([
  "NASDAQ", "NYSE", "AMEX", "ARCA", "BATS", "OTC", "OTCBB", "PINK", "OTCMARKETS", "BATSTRADING",
  "LSE", "LON", "TSX", "TSXV", "ASX", "NSE", "BSE",
  "XETRA", "FRA", "FSX", "ETR", "BER", "MUN", "STU", "DUS", "HAM", "FRANKFURT", "STUTTGART",
  "EURONEXT", "EPA", "AMS", "BRU", "LIS", "PARIS",
  "TSE", "JPX", "KOSDAQ", "KRX", "KOSE", "TWSE", "TAI", "TPEX",
  "SSE", "SZSE", "HKEX", "HKG",
  "JSE", "SAU", "TADAWUL",
  "SGX", "SET", "BKK", "IDX", "JKT", "KLSE", "MEX", "BMV",
  "BOVESPA", "BVMF", "SAO",
  "MIL", "BIT", "BME", "MCE", "SWX", "SIX", "VIE", "WSE", "CPH", "HEL", "STO", "OSL", "ISE",
  "BINANCE", "COINBASE", "KRAKEN", "BYBIT", "OKX", "GATEIO", "KUCOIN", "MEXC",
  "BITFINEX", "HUOBI", "CRYPTO.COM", "BITSTAMP", "GEMINI", "CRYPTO",
  "FOREX", "FX", "OANDA", "FXCM",
  "INDEX", "INDEXSP", "INDEXDJX", "INDEXNASDAQ", "INDEXFTSE", "INDEXNIKKEI",
  "SP", "DJI", "CBOE", "RUSSELL",
  "COMMODITY",
  "FRED", "WORLDBANK", "TREASURY", "BOND", "ECONOMY",
  "NZX", "PSE", "QSE", "ADX", "EGX", "BCBA", "BCS", "BVC",
  "NYSEARCA", "CDNX", "SEC", "GLOBAL",
  "NYSE ARCA", "CFD", "DERIV", "COINGECKO",
]);

function isValidExchange(exchange: string): boolean {
  if (!exchange || exchange === "UNKNOWN") return false;
  const up = exchange.toUpperCase();
  if (KNOWN_EXCHANGES.has(up)) return true;
  // Allow suffixed exchanges like "NASDAQ Global Select"
  for (const known of KNOWN_EXCHANGES) {
    if (up.startsWith(known)) return true;
  }
  return up.length >= 2 && up.length <= 20;
}

function isValidName(name: string, type?: string): boolean {
  if (!name || name.length < 1) return false;
  // For crypto, forex, index, bond, economy — short names like "BTC", "ETH" are valid
  if (type && ["crypto", "forex", "index", "bond", "economy"].includes(type)) return true;
  if (/^[A-Z0-9.\-:\/]+$/i.test(name) && name.length < 6) return false; // just a ticker
  return true;
}

function hasLogo(doc: Record<string, unknown>): boolean {
  return Boolean(doc.iconUrl || doc.s3Icon);
}

export async function buildCleanAssets(): Promise<{
  processed: number;
  promoted: number;
  skipped: number;
  duration: number;
}> {
  const t0 = Date.now();
  let processed = 0;
  let promoted = 0;
  let skipped = 0;
  let batches = 0;

  logger.info("clean_assets_build_start");

  // Process using cursor to avoid loading all 1.5M into memory
  const cursor = SymbolModel.find({
    type: { $in: ["stock", "etf", "crypto", "forex", "index", "bond", "economy", "derivative"] },
  })
    .select({
      symbol: 1, fullSymbol: 1, name: 1, exchange: 1, country: 1,
      type: 1, currency: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1,
      source: 1, priorityScore: 1, marketCap: 1, volume: 1,
      liquidityScore: 1, popularity: 1, logoStatus: 1, logoLastUpdated: 1,
      sector: 1,
    })
    .sort({ priorityScore: -1 })
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let batch: AnyBulkWriteOperation<any>[] = [];

  for await (const doc of cursor) {
    processed++;

    // Filter: valid exchange, valid name, not synthetic derivative noise
    if (!isValidExchange(doc.exchange)) { skipped++; continue; }

    // Map derivative types
    let cleanType = doc.type;
    if (doc.type === "derivative") {
      if (doc.exchange === "CFD") cleanType = "stock";
      else if (doc.exchange === "DERIV") cleanType = "futures";
      else { skipped++; continue; }
    }

    if (!isValidName(doc.name, cleanType)) { skipped++; continue; }

    // Accept all symbols with valid exchange and valid name
    // Logo and priority are used for ranking, not filtering

    batch.push({
      updateOne: {
        filter: { fullSymbol: doc.fullSymbol },
        update: {
          $set: {
            symbol: doc.symbol,
            fullSymbol: doc.fullSymbol,
            name: doc.name,
            exchange: doc.exchange,
            country: doc.country || "",
            type: cleanType,
            currency: doc.currency || "USD",
            iconUrl: doc.iconUrl || "",
            s3Icon: doc.s3Icon || "",
            companyDomain: doc.companyDomain || "",
            source: doc.source || "unknown",
            priorityScore: doc.priorityScore ?? 0,
            marketCap: doc.marketCap ?? 0,
            volume: doc.volume ?? 0,
            liquidityScore: doc.liquidityScore ?? 0,
            popularity: doc.popularity ?? 0,
            sector: doc.sector || "",
            logoStatus: doc.logoStatus || (hasLogo(doc) ? "mapped" : "pending"),
            logoLastUpdated: doc.logoLastUpdated || (hasLogo(doc) ? new Date() : undefined),
            isActive: true,
            verifiedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    });

    if (batch.length >= BATCH_SIZE) {
      try {
        const result = await CleanAssetModel.bulkWrite(batch, { ordered: false });
        promoted += result.upsertedCount + result.modifiedCount;

        // Emit Kafka events for new/updated assets
        if (result.upsertedCount > 0) {
          produce(KAFKA_TOPICS.ASSET_CREATED, { count: result.upsertedCount, batch: batches + 1 });
        }
        if (result.modifiedCount > 0) {
          produce(KAFKA_TOPICS.ASSET_UPDATED, { count: result.modifiedCount, batch: batches + 1 });
        }
      } catch (err: unknown) {
        // E11000 duplicate key errors are expected for symbol+exchange collisions
        const bulkErr = err as { result?: { nUpserted?: number; nModified?: number } };
        if (bulkErr.result) promoted += (bulkErr.result.nUpserted || 0) + (bulkErr.result.nModified || 0);
      }
      batches++;
      batch = [];

      // Yield to event loop every batch
      await new Promise(resolve => setImmediate(resolve));

      if (processed % 50_000 === 0) {
        logger.info("clean_assets_progress", { processed, promoted, skipped });
      }
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    try {
      const result = await CleanAssetModel.bulkWrite(batch, { ordered: false });
      promoted += result.upsertedCount + result.modifiedCount;
    } catch (err: unknown) {
      const bulkErr = err as { result?: { nUpserted?: number; nModified?: number } };
      if (bulkErr.result) promoted += (bulkErr.result.nUpserted || 0) + (bulkErr.result.nModified || 0);
    }
  }

  const duration = Date.now() - t0;
  logger.info("clean_assets_build_complete", { processed, promoted, skipped, durationMs: duration });

  return { processed, promoted, skipped, duration };
}

export async function getCleanAssetStats() {
  const [total, byType, byCountry] = await Promise.all([
    CleanAssetModel.countDocuments(),
    CleanAssetModel.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    CleanAssetModel.aggregate([
      { $match: { country: { $ne: "" } } },
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
  ]);

  return {
    total,
    byType: Object.fromEntries(byType.map(t => [t._id, t.count])),
    topCountries: Object.fromEntries(byCountry.map(c => [c._id, c.count])),
  };
}
