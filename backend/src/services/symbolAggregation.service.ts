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
  epsGrowth: number | null;
  dividendYield: number | null;
  netIncome: number | null;
  revenue: number | null;
  sharesFloat: number | null;
  beta: number | null;
  revenueGrowth: number | null;
  roe: number | null;
  avgVolume: number | null;
  analystRating: string;

  // Meta
  logoSource: string;
  isSynthetic: boolean;

  // Company profile (populated by enrichment; empty string if unavailable)
  industry: string;
  ceo: string;
  headquarters: string;
  founded: string;
  ipoDate: string;
  isin: string;
  cfiCode: string;
  description: string;

  // Earnings
  recentEarningsDate: string;
  upcomingEarningsDate: string;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

/* ── Fundamentals (real data only — no synthetic generation) ────────── */

interface Fundamentals {
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  epsGrowth: number | null;
  dividendYield: number | null;
  netIncome: number | null;
  revenue: number | null;
  sharesFloat: number | null;
  beta: number | null;
  revenueGrowth: number | null;
  roe: number | null;
  avgVolume: number | null;
  analystRating: string;
}

function pickNumber(doc: any, keys: string[]): number | null {
  for (const key of keys) {
    const value = doc?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function normalizeRatio(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value > 1 && value <= 100) return value / 100;
  return value;
}

function normalizeAnalystRating(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("strong") && normalized.includes("buy")) return "strong-buy";
  if (normalized.includes("strong") && normalized.includes("sell")) return "strong-sell";
  if (["buy", "outperform", "overweight", "accumulate", "positive"].includes(normalized)) return "buy";
  if (["sell", "underperform", "underweight", "reduce", "negative"].includes(normalized)) return "sell";
  if (["hold", "neutral", "market perform", "market-perform", "equal weight", "equal-weight", "mixed"].includes(normalized)) return "neutral";
  return normalized.replace(/\s+/g, "-");
}

/**
 * Extract fundamentals from the DB document.
 * Only uses fields that actually exist in the data layer.
 * Returns null for fields not available — never fabricates values.
 */
function extractFundamentals(doc: any): Fundamentals {
  const marketCap = pickNumber(doc, ["marketCap", "mktCap"]);
  const pe = pickNumber(doc, ["pe", "peRatio", "peRatioTTM", "priceEarningsRatioTTM"]);
  const eps = pickNumber(doc, ["eps", "epsTTM", "epsDiluted", "epsDilutedTTM"]);
  const epsGrowth = normalizeRatio(pickNumber(doc, ["epsGrowth", "epsDilGrowth", "epsGrowthTTM", "earningsGrowth"]));
  const dividendYield = normalizeRatio(pickNumber(doc, ["dividendYield", "dividendYieldTTM", "lastAnnualDividend"]));
  const netIncome = pickNumber(doc, ["netIncome", "netIncomeTTM"]);
  const revenue = pickNumber(doc, ["revenue", "revenueTTM", "totalRevenue"]);
  const sharesFloat = pickNumber(doc, ["sharesFloat", "floatShares", "sharesOutstanding"]);
  const beta = pickNumber(doc, ["beta"]);
  const revenueGrowth = normalizeRatio(pickNumber(doc, ["revenueGrowth", "revenueGrowthTTM"]));
  const roe = normalizeRatio(pickNumber(doc, ["roe", "returnOnEquity", "returnOnEquityTTM"]));
  const avgVolume = pickNumber(doc, ["avgVolume", "averageVolume", "volAvg", "volumeAvg"]);

  return {
    marketCap: marketCap != null && marketCap > 0 ? marketCap : null,
    pe: pe != null && pe > 0 ? pe : null,
    eps,
    epsGrowth,
    dividendYield: dividendYield != null && dividendYield >= 0 ? dividendYield : null,
    netIncome,
    revenue: revenue != null && revenue > 0 ? revenue : null,
    sharesFloat: sharesFloat != null && sharesFloat > 0 ? sharesFloat : null,
    beta,
    revenueGrowth,
    roe,
    avgVolume: avgVolume != null && avgVolume > 0 ? avgVolume : null,
    analystRating: normalizeAnalystRating(
      doc.analystRating
      ?? doc.consensus
      ?? doc.recommendation
      ?? doc.rating
      ?? "",
    ),
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

      // Company profile
      industry: doc.industry || "",
      ceo: doc.ceo || "",
      headquarters: doc.headquarters || "",
      founded: doc.founded || "",
      ipoDate: doc.ipoDate || "",
      isin: doc.isin || "",
      cfiCode: doc.cfiCode || "",
      description: doc.description || "",

      // Earnings
      recentEarningsDate: doc.recentEarningsDate || "",
      upcomingEarningsDate: doc.upcomingEarningsDate || "",
      epsEstimate: typeof doc.epsEstimate === "number" && Number.isFinite(doc.epsEstimate) ? doc.epsEstimate : null,
      revenueEstimate: typeof doc.revenueEstimate === "number" && Number.isFinite(doc.revenueEstimate) ? doc.revenueEstimate : null,
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

        // Company profile
        industry: doc.industry || "",
        ceo: doc.ceo || "",
        headquarters: doc.headquarters || "",
        founded: doc.founded || "",
        ipoDate: doc.ipoDate || "",
        isin: doc.isin || "",
        cfiCode: doc.cfiCode || "",
        description: doc.description || "",

        // Earnings
        recentEarningsDate: doc.recentEarningsDate || "",
        upcomingEarningsDate: doc.upcomingEarningsDate || "",
        epsEstimate: typeof doc.epsEstimate === "number" && Number.isFinite(doc.epsEstimate) ? doc.epsEstimate : null,
        revenueEstimate: typeof doc.revenueEstimate === "number" && Number.isFinite(doc.revenueEstimate) ? doc.revenueEstimate : null,
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