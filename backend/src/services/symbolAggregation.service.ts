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

  // Fundamentals (null = data not available)
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  dividendYield: number | null;
  netIncome: number | null;
  revenue: number | null;
  sharesFloat: number | null;
  beta: number | null;
  revenueGrowth: number | null;
  roe: number | null;

  // Meta
  logoSource: string;
  isSynthetic: boolean;
}

/* ── Fundamentals (real data only — no synthetic generation) ────────── */

interface Fundamentals {
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  dividendYield: number | null;
  netIncome: number | null;
  revenue: number | null;
  sharesFloat: number | null;
  beta: number | null;
  revenueGrowth: number | null;
  roe: number | null;
}

/**
 * Extract fundamentals from the DB document.
 * Only uses fields that actually exist in the data layer.
 * Returns null for fields not available — never fabricates values.
 */
function extractFundamentals(doc: any): Fundamentals {
  return {
    marketCap: typeof doc.marketCap === "number" && doc.marketCap > 0 ? doc.marketCap : null,
    pe: typeof doc.pe === "number" && doc.pe > 0 ? doc.pe : null,
    eps: typeof doc.eps === "number" ? doc.eps : null,
    dividendYield: typeof doc.dividendYield === "number" && doc.dividendYield > 0 ? doc.dividendYield : null,
    netIncome: typeof doc.netIncome === "number" ? doc.netIncome : null,
    revenue: typeof doc.revenue === "number" && doc.revenue > 0 ? doc.revenue : null,
    sharesFloat: typeof doc.sharesFloat === "number" && doc.sharesFloat > 0 ? doc.sharesFloat : null,
    beta: typeof doc.beta === "number" ? doc.beta : null,
    revenueGrowth: typeof doc.revenueGrowth === "number" ? doc.revenueGrowth : null,
    roe: typeof doc.roe === "number" ? doc.roe : null,
  };
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

    const fundamentals = extractFundamentals(doc);

    const volume = priceData.volume > 0 ? priceData.volume
      : (doc.volume || 0) > 0 ? doc.volume
      : 0;

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

      const fundamentals = extractFundamentals(doc);
      const volume = priceData.volume > 0 ? priceData.volume
        : (doc.volume || 0) > 0 ? doc.volume
        : 0;

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