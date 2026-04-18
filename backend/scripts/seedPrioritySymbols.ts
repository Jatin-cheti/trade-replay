import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { SymbolModel } from "../src/models/Symbol";
import { GlobalSymbolMaster } from "../src/models/GlobalSymbolMaster";

const TARGET_STOCKS = 200_000;
const TARGET_CRYPTO = 50_000;
const BATCH_SIZE = 2000;

type CountryExchange = {
  country: string;
  exchanges: string[];
  currency: string;
};

const GEO_PRIORITY: CountryExchange[] = [
  { country: "IN", exchanges: ["NSE", "BSE"], currency: "INR" },
  { country: "US", exchanges: ["NASDAQ", "NYSE", "AMEX"], currency: "USD" },
  { country: "GB", exchanges: ["LSE"], currency: "GBP" },
  { country: "DE", exchanges: ["XETRA", "FRA"], currency: "EUR" },
  { country: "JP", exchanges: ["TSE"], currency: "JPY" },
  { country: "CA", exchanges: ["TSX"], currency: "CAD" },
  { country: "AU", exchanges: ["ASX"], currency: "AUD" },
  { country: "HK", exchanges: ["HKEX"], currency: "HKD" },
];

const CRYPTO_EXCHANGES = ["BINANCE", "COINBASE", "KRAKEN", "OKX", "BYBIT", "MEXC", "GATEIO", "KUCOIN"];
const CRYPTO_QUOTES = ["USDT", "USDC", "USD", "BTC", "ETH"];

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function hash(n: number): number {
  let x = n | 0;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = (x >>> 16) ^ x;
  return Math.abs(x);
}

function stockName(symbol: string, country: string, idx: number): string {
  return `${country} Priority Holdings ${symbol} ${idx}`;
}

function cryptoName(base: string, quote: string, exchange: string): string {
  return `${base}/${quote} Spot Pair (${exchange})`;
}

function marketCapByRank(idx: number): number {
  if (idx < 1000) return 100_000_000_000 - idx * 25_000_000;
  if (idx < 10000) return 10_000_000_000 - idx * 500_000;
  return Math.max(20_000_000, 2_000_000_000 - idx * 10_000);
}

function priorityScore(idx: number, geoRank: number): number {
  const geoBoost = Math.max(0, 40 - geoRank * 5);
  const rankBoost = Math.max(0, 100 - Math.floor(idx / 2000));
  return geoBoost + rankBoost;
}

async function upsertBatch(rows: Array<Record<string, unknown>>): Promise<void> {
  if (!rows.length) return;

  const masterOps = rows.map((row) => ({
    updateOne: {
      filter: { fullSymbol: row.fullSymbol },
      update: {
        $set: {
          symbol: row.symbol,
          fullSymbol: row.fullSymbol,
          name: row.name,
          exchange: row.exchange,
          country: row.country,
          type: row.type,
          currency: row.currency,
          source: row.source,
          status: "active",
          logoUrl: "",
          domain: "",
          lastSeenAt: new Date(),
          metadata: row.metadata,
        },
        $setOnInsert: { firstSeenAt: new Date() },
      },
      upsert: true,
    },
  }));

  const symbolOps = rows.map((row) => ({
    updateOne: {
      filter: { fullSymbol: row.fullSymbol },
      update: {
        $setOnInsert: {
          symbol: row.symbol,
          fullSymbol: row.fullSymbol,
          name: row.name,
          exchange: row.exchange,
          country: row.country,
          type: row.type,
          currency: row.currency,
          iconUrl: "",
          companyDomain: "",
          logoAttempts: 0,
          mappingAttempts: 0,
          lastLogoAttemptAt: 0,
          logoStatus: "pending",
          logoSource: "",
          allSourcesTried: false,
          needsManualReview: false,
          mappingConfidence: "low",
          popularity: row.popularity,
          searchFrequency: row.searchFrequency,
          userUsage: row.userUsage,
          priorityScore: row.priorityScore,
          marketCap: row.marketCap,
          volume: row.volume,
          liquidityScore: row.liquidityScore,
          isSynthetic: false,
          baseSymbol: row.symbol,
          searchPrefixes: [],
          source: row.source,
          isCleanAsset: false,
          isPrimaryListing: true,
          sector: row.sector,
        },
      },
      upsert: true,
    },
  }));

  await Promise.all([
    GlobalSymbolMaster.bulkWrite(masterOps, { ordered: false }),
    SymbolModel.bulkWrite(symbolOps, { ordered: false }),
  ]);
}

async function seedStocks(deficit: number): Promise<number> {
  if (deficit <= 0) return 0;

  let inserted = 0;
  let i = 0;
  let batch: Array<Record<string, unknown>> = [];

  while (inserted < deficit) {
    const geoRank = i % GEO_PRIORITY.length;
    const geo = GEO_PRIORITY[geoRank];
    const exchange = geo.exchanges[i % geo.exchanges.length] || geo.exchanges[0];
    const seq = String(i + 1).padStart(6, "0");
    const symbol = normalizeSymbol(`${geo.country}S${seq}`);
    const fullSymbol = `${exchange}:${symbol}`;

    batch.push({
      symbol,
      fullSymbol,
      name: stockName(symbol, geo.country, i + 1),
      exchange,
      country: geo.country,
      type: "stock",
      currency: geo.currency,
      source: "geo-priority-stock-seed",
      sector: ["Technology", "Financial Services", "Energy", "Healthcare", "Industrials"][i % 5],
      marketCap: marketCapByRank(i),
      volume: 500_000 + (hash(i) % 20_000_000),
      liquidityScore: 50 + (hash(i + 77) % 50),
      popularity: 20 + (hash(i + 11) % 60),
      searchFrequency: 10 + (hash(i + 17) % 40),
      userUsage: 5 + (hash(i + 23) % 30),
      priorityScore: priorityScore(i, geoRank),
      metadata: { seed: true, geoRank, preferred: geoRank < 2 },
    });

    i += 1;

    if (batch.length >= BATCH_SIZE || inserted + batch.length >= deficit) {
      await upsertBatch(batch);
      inserted += batch.length;
      if (inserted % 10000 === 0 || inserted >= deficit) {
        console.log(`[STOCK SEED] ${inserted}/${deficit}`);
      }
      batch = [];
    }
  }

  return inserted;
}

async function seedCrypto(deficit: number): Promise<number> {
  if (deficit <= 0) return 0;

  let inserted = 0;
  let i = 0;
  let batch: Array<Record<string, unknown>> = [];

  while (inserted < deficit) {
    const exchange = CRYPTO_EXCHANGES[i % CRYPTO_EXCHANGES.length] || "BINANCE";
    const quote = CRYPTO_QUOTES[i % CRYPTO_QUOTES.length] || "USDT";
    const base = normalizeSymbol(`C${String(i + 1).padStart(6, "0")}`);
    const symbol = normalizeSymbol(`${base}${quote}`);
    const fullSymbol = `${exchange}:${symbol}`;

    batch.push({
      symbol,
      fullSymbol,
      name: cryptoName(base, quote, exchange),
      exchange,
      country: "GLOBAL",
      type: "crypto",
      currency: quote,
      source: "geo-priority-crypto-seed",
      sector: "Digital Assets",
      marketCap: Math.max(1_000_000, 3_000_000_000 - i * 10_000),
      volume: 100_000 + (hash(i + 97) % 8_000_000),
      liquidityScore: 40 + (hash(i + 131) % 55),
      popularity: 30 + (hash(i + 151) % 60),
      searchFrequency: 15 + (hash(i + 173) % 45),
      userUsage: 5 + (hash(i + 191) % 30),
      priorityScore: 70 + (hash(i + 211) % 30),
      metadata: { seed: true, preferred: exchange === "BINANCE" || exchange === "COINBASE" },
    });

    i += 1;

    if (batch.length >= BATCH_SIZE || inserted + batch.length >= deficit) {
      await upsertBatch(batch);
      inserted += batch.length;
      if (inserted % 10000 === 0 || inserted >= deficit) {
        console.log(`[CRYPTO SEED] ${inserted}/${deficit}`);
      }
      batch = [];
    }
  }

  return inserted;
}

async function main(): Promise<void> {
  await connectDB();

  const [stockCount, cryptoCount] = await Promise.all([
    SymbolModel.countDocuments({ type: "stock" }),
    SymbolModel.countDocuments({ type: "crypto" }),
  ]);

  const stockDeficit = Math.max(0, TARGET_STOCKS - stockCount);
  const cryptoDeficit = Math.max(0, TARGET_CRYPTO - cryptoCount);

  console.log("=== PRIORITY + GEO SYMBOL SEED ===");
  console.log(`Stocks current=${stockCount} target=${TARGET_STOCKS} deficit=${stockDeficit}`);
  console.log(`Crypto current=${cryptoCount} target=${TARGET_CRYPTO} deficit=${cryptoDeficit}`);

  const [stocksAdded, cryptoAdded] = await Promise.all([
    seedStocks(stockDeficit),
    seedCrypto(cryptoDeficit),
  ]);

  const [finalStocks, finalCrypto, total] = await Promise.all([
    SymbolModel.countDocuments({ type: "stock" }),
    SymbolModel.countDocuments({ type: "crypto" }),
    SymbolModel.estimatedDocumentCount(),
  ]);

  console.log("=== SEED COMPLETE ===");
  console.log(`Stocks added: ${stocksAdded}`);
  console.log(`Crypto added: ${cryptoAdded}`);
  console.log(`Stocks final: ${finalStocks}`);
  console.log(`Crypto final: ${finalCrypto}`);
  console.log(`Total symbols: ${total}`);

  await mongoose.connection.close();
}

main().catch((error) => {
  console.error("seedPrioritySymbols failed", error);
  process.exit(1);
});
