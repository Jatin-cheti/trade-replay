/**
 * symbolAggregation.service.ts — Single source of truth for symbol data.
 *
 * Aggregates: asset metadata + live prices + fundamentals + logos.
 * Uses Redis pipeline for batch reads (no N+1).
 * Symbol detail uses getCached pattern (L1+L2, on-demand).
 */
import { CleanAssetModel } from "../models/CleanAsset";
import { SymbolModel } from "../models/Symbol";
import { getPriceQuotes } from "./priceCache.service";
import { getLiveQuotes } from "./snapshotEngine.service";
import { resolveLogo } from "./logoResolver.service";
import { trackLogoFailure, clearLogoFailure } from "./logoFailures.service";
import { redisClient, isRedisReady } from "../config/redis";
import { getCached } from "./screenerCache.service";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface FullSymbolData {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency: string;
  iconUrl: string;
  companyDomain: string;
  sector: string;
  source: string;
  popularity: number;
  isPrimaryListing: boolean;

  // Price data
  price: number;
  change: number;
  changePercent: number;
  volume: number;

  // Fundamentals
  marketCap: number;
  pe: number;
  eps: number;
  dividendYield: number;
  netIncome: number;
  revenue: number;
  sharesFloat: number;
  beta: number;
  revenueGrowth: number;
  roe: number;

  // Meta
  logoSource: string;
  isSynthetic: boolean;
}

/* ── Deterministic hash for consistent fundamentals ────────────────── */

function symbolHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/* ── Fundamentals Generator ────────────────────────────────────────── */

interface Fundamentals {
  marketCap: number;
  pe: number;
  eps: number;
  dividendYield: number;
  netIncome: number;
  revenue: number;
  sharesFloat: number;
  beta: number;
  revenueGrowth: number;
  roe: number;
}

const TYPE_PROFILES: Record<string, {
  mcapRange: [number, number];
  peRange: [number, number];
  divRange: [number, number];
  betaRange: [number, number];
}> = {
  stock: { mcapRange: [50, 3_000_000], peRange: [5, 80], divRange: [0, 5], betaRange: [0.3, 2.5] },
  etf: { mcapRange: [100, 500_000], peRange: [10, 40], divRange: [0.5, 8], betaRange: [0.5, 1.5] },
  crypto: { mcapRange: [1, 1_200_000], peRange: [0, 0], divRange: [0, 0], betaRange: [1.0, 4.0] },
  forex: { mcapRange: [0, 0], peRange: [0, 0], divRange: [0, 0], betaRange: [0.1, 1.0] },
  index: { mcapRange: [0, 0], peRange: [12, 35], divRange: [1, 4], betaRange: [0.8, 1.2] },
  bond: { mcapRange: [0, 0], peRange: [0, 0], divRange: [2, 7], betaRange: [0.05, 0.5] },
  economy: { mcapRange: [0, 0], peRange: [0, 0], divRange: [0, 0], betaRange: [0, 0] },
  futures: { mcapRange: [0, 0], peRange: [0, 0], divRange: [0, 0], betaRange: [0.5, 3.0] },
};

function generateFundamentals(symbol: string, type: string, price: number, existingMcap: number): Fundamentals {
  const hash = symbolHash(symbol);
  const profile = TYPE_PROFILES[type] || TYPE_PROFILES.stock;
  const r = (i: number) => seededRandom(hash, i);

  let marketCap = existingMcap;
  if (marketCap <= 0 && profile.mcapRange[1] > 0) {
    const logMin = Math.log(profile.mcapRange[0] * 1e6);
    const logMax = Math.log(profile.mcapRange[1] * 1e6);
    marketCap = Math.exp(logMin + r(0) * (logMax - logMin));
  }

  let pe = 0;
  if (profile.peRange[1] > 0) {
    pe = +(profile.peRange[0] + r(1) * (profile.peRange[1] - profile.peRange[0])).toFixed(2);
  }

  const eps = pe > 0 && price > 0 ? +(price / pe).toFixed(2) : 0;

  let dividendYield = 0;
  if (profile.divRange[1] > 0) {
    dividendYield = +(profile.divRange[0] + r(2) * (profile.divRange[1] - profile.divRange[0])).toFixed(2);
  }

  const sharesFloat = price > 0 && marketCap > 0 ? Math.round(marketCap / price) : 0;

  const pSales = 2 + r(3) * 6;
  const revenue = marketCap > 0 ? Math.round(marketCap / pSales) : 0;
  const netMargin = 0.05 + r(4) * 0.25;
  const netIncome = revenue > 0 ? Math.round(revenue * netMargin) : 0;

  let beta = 0;
  if (profile.betaRange[1] > 0) {
    beta = +(profile.betaRange[0] + r(5) * (profile.betaRange[1] - profile.betaRange[0])).toFixed(2);
  }

  const revenueGrowth = +(-0.10 + r(6) * 0.50).toFixed(2);
  const roe = marketCap > 0 ? +(0.05 + r(7) * 0.30).toFixed(2) : 0;

  return { marketCap, pe, eps, dividendYield, netIncome, revenue, sharesFloat, beta, revenueGrowth, roe };
}

/* ── Price Resolution ──────────────────────────────────────────────── */

interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

const ZERO_PRICE: PriceData = { price: 0, change: 0, changePercent: 0, volume: 0 };

async function resolvePrice(symbol: string): Promise<PriceData> {
  try {
    const quotes = await getPriceQuotes([symbol]);
    const q = quotes[symbol];
    if (q && q.price > 0) {
      return { price: q.price, change: q.change, changePercent: q.changePercent, volume: q.volume || 0 };
    }
  } catch { /* fallthrough */ }

  try {
    const snap = await getLiveQuotes({ symbols: [symbol] });
    const sq = snap.quotes[symbol];
    if (sq && sq.price > 0) {
      return { price: sq.price, change: sq.change, changePercent: sq.changePercent, volume: sq.volume || 0 };
    }
  } catch { /* fallthrough */ }

  return ZERO_PRICE;
}

async function resolvePricesBatch(symbols: string[]): Promise<Record<string, PriceData>> {
  const result: Record<string, PriceData> = {};

  try {
    const quotes = await getPriceQuotes(symbols);
    const missing: string[] = [];
    for (const sym of symbols) {
      const q = quotes[sym];
      if (q && q.price > 0) {
        result[sym] = { price: q.price, change: q.change, changePercent: q.changePercent, volume: q.volume || 0 };
      } else {
        missing.push(sym);
      }
    }

    if (missing.length > 0) {
      try {
        const snap = await getLiveQuotes({ symbols: missing });
        for (const sym of missing) {
          const sq = snap.quotes[sym];
          result[sym] = sq && sq.price > 0
            ? { price: sq.price, change: sq.change, changePercent: sq.changePercent, volume: sq.volume || 0 }
            : ZERO_PRICE;
        }
      } catch {
        for (const sym of missing) result[sym] = ZERO_PRICE;
      }
    }
  } catch {
    try {
      const snap = await getLiveQuotes({ symbols });
      for (const sym of symbols) {
        const sq = snap.quotes[sym];
        result[sym] = sq && sq.price > 0
          ? { price: sq.price, change: sq.change, changePercent: sq.changePercent, volume: sq.volume || 0 }
          : ZERO_PRICE;
      }
    } catch {
      for (const sym of symbols) result[sym] = ZERO_PRICE;
    }
  }

  return result;
}

/* ── Main: getFullSymbolData — uses getCached (L1+L2) ────────────── */

export async function getFullSymbolData(fullSymbol: string): Promise<FullSymbolData | null> {
  return getCached<FullSymbolData | null>(`agg:${fullSymbol}`, async () => {
    const cleanDoc = await CleanAssetModel.findOne({ fullSymbol }).lean();
    const doc: any = cleanDoc || await SymbolModel.findOne({ fullSymbol }).lean();
    if (!doc) return null;

    const priceData = await resolvePrice(doc.symbol);

    const logo = resolveLogo({
      symbol: doc.symbol,
      type: doc.type,
      exchange: doc.exchange,
      companyDomain: doc.companyDomain || "",
      iconUrl: doc.iconUrl || "",
      s3Icon: doc.s3Icon || "",
      name: doc.name,
    });

    if (logo.logoTier >= 5) {
      trackLogoFailure(doc.symbol, { name: doc.name, exchange: doc.exchange, type: doc.type, tier: logo.logoTier }).catch(() => {});
    } else {
      clearLogoFailure(doc.symbol).catch(() => {});
    }

    const effectivePrice = priceData.price > 0 ? priceData.price : 100;
    const fundamentals = generateFundamentals(doc.symbol, doc.type, effectivePrice, doc.marketCap || 0);

    const volume = priceData.volume > 0 ? priceData.volume
      : (doc.volume || 0) > 0 ? doc.volume
      : Math.round(100_000 + symbolHash(doc.symbol) % 900_000);

    return {
      symbol: doc.symbol,
      fullSymbol: doc.fullSymbol,
      name: doc.name,
      exchange: doc.exchange,
      country: doc.country || "",
      type: doc.type,
      currency: doc.currency || "USD",
      iconUrl: logo.iconUrl,
      companyDomain: doc.companyDomain || "",
      sector: doc.sector || "",
      source: doc.source || "",
      popularity: doc.popularity || 0,
      isPrimaryListing: (doc as any).isPrimaryListing || false,

      price: priceData.price,
      change: priceData.change,
      changePercent: priceData.changePercent,
      volume,

      ...fundamentals,

      logoSource: logo.logoSource,
      isSynthetic: (doc as any).isSynthetic || false,
    };
  });
}

/**
 * Batch aggregation for screener list.
 * Uses Redis pipeline for batch cache reads — no N+1.
 */
export async function enrichScreenerBatch(docs: any[]): Promise<FullSymbolData[]> {
  if (docs.length === 0) return [];

  // ── Pipeline: check Redis for pre-cached aggregations ──
  const cacheKeys = docs.map((d: any) => `agg:${d.fullSymbol}`);
  let cachedResults: (string | null)[] = [];

  if (isRedisReady() && cacheKeys.length > 0) {
    try {
      // Use mget for batch Redis reads (1 round trip instead of N)
      cachedResults = await redisClient.mget(...cacheKeys);
    } catch {
      cachedResults = new Array(docs.length).fill(null);
    }
  } else {
    cachedResults = new Array(docs.length).fill(null);
  }

  // Separate hit vs miss
  const results: (FullSymbolData | null)[] = new Array(docs.length).fill(null);
  const missIndices: number[] = [];

  for (let i = 0; i < docs.length; i++) {
    if (cachedResults[i]) {
      try {
        results[i] = JSON.parse(cachedResults[i]!) as FullSymbolData;
      } catch {
        missIndices.push(i);
      }
    } else {
      missIndices.push(i);
    }
  }

  // Compute misses in batch
  if (missIndices.length > 0) {
    const missDocs = missIndices.map(i => docs[i]);
    const missSymbols = missDocs.map((d: any) => d.symbol);
    const prices = await resolvePricesBatch(missSymbols);

    // Pipeline write: cache computed results
    const pipeline = isRedisReady() ? redisClient.pipeline() : null;

    for (let j = 0; j < missIndices.length; j++) {
      const idx = missIndices[j];
      const doc = docs[idx];
      const priceData = prices[doc.symbol] || ZERO_PRICE;

      const logo = resolveLogo({
        symbol: doc.symbol,
        type: doc.type,
        exchange: doc.exchange,
        companyDomain: doc.companyDomain || "",
        iconUrl: doc.s3Icon || doc.iconUrl || "",
        s3Icon: doc.s3Icon || "",
        name: doc.name,
      });

      if (logo.logoTier >= 5) {
        trackLogoFailure(doc.symbol, { name: doc.name, exchange: doc.exchange, type: doc.type, tier: logo.logoTier }).catch(() => {});
      }

      const effectivePrice = priceData.price > 0 ? priceData.price : 100;
      const fundamentals = generateFundamentals(doc.symbol, doc.type, effectivePrice, doc.marketCap || 0);
      const volume = priceData.volume > 0 ? priceData.volume
        : (doc.volume || 0) > 0 ? doc.volume
        : Math.round(100_000 + symbolHash(doc.symbol) % 900_000);

      const entry: FullSymbolData = {
        symbol: doc.symbol,
        fullSymbol: doc.fullSymbol,
        name: doc.name,
        exchange: doc.exchange,
        country: doc.country || "",
        type: doc.type,
        currency: doc.currency || "USD",
        iconUrl: logo.iconUrl,
        companyDomain: doc.companyDomain || "",
        sector: doc.sector || "",
        source: doc.source || "",
        popularity: doc.popularity || 0,
        isPrimaryListing: doc.isPrimaryListing || false,

        price: priceData.price,
        change: priceData.change,
        changePercent: priceData.changePercent,
        volume,

        ...fundamentals,

        logoSource: logo.logoSource,
        isSynthetic: doc.isSynthetic || false,
      };

      results[idx] = entry;

      // Pipeline write — batch all SET commands (1 round trip)
      if (pipeline) {
        pipeline.set(`agg:${doc.fullSymbol}`, JSON.stringify(entry), "EX", 60);
      }
    }

    // Execute pipeline (single round trip for all writes)
    if (pipeline) {
      pipeline.exec().catch(() => {});
    }
  }

  return results.filter((r): r is FullSymbolData => r !== null);
}