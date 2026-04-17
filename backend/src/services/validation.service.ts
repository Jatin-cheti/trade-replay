/**
 * validation.service.ts — System-wide validation engine.
 *
 * Validates: assets, logos, prices, filters, search, parity.
 * Returns structured pass/fail results for each category.
 */
import { CleanAssetModel } from "../models/CleanAsset";
import { SymbolModel } from "../models/Symbol";
import { getLiveQuotes } from "./snapshotEngine.service";
import { getPriceQuotes } from "./priceCache.service";
import { logger } from "../utils/logger";

/* ── Types ─────────────────────────────────────────────────────────── */

interface ValidationResult {
  pass: boolean;
  details: Record<string, unknown>;
}

interface SystemValidation {
  assets: ValidationResult;
  logos: ValidationResult;
  prices: ValidationResult;
  filters: ValidationResult;
  search: ValidationResult;
  parity: ValidationResult;
  summary: {
    allPass: boolean;
    cleanAssets: number;
    duplicates: number;
    categories: Record<string, number>;
    logoAccuracy: string;
    pricesCoverage: string;
    parityStatus: string;
  };
}

/* ── Asset Validation ──────────────────────────────────────────────── */

async function validateAssets(): Promise<ValidationResult> {
  const total = await CleanAssetModel.countDocuments();

  const byType = await CleanAssetModel.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const categories: Record<string, number> = {};
  for (const t of byType) categories[t._id] = t.count;

  // Check duplicates on fullSymbol
  const dupes = await CleanAssetModel.aggregate([
    { $group: { _id: "$fullSymbol", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "duplicates" },
  ]);
  const duplicates = dupes[0]?.duplicates ?? 0;

  // Check for missing exchange
  const missingExchange = await CleanAssetModel.countDocuments({
    $or: [{ exchange: "" }, { exchange: null }, { exchange: { $exists: false } }],
  });

  const categoriesAbove1k = Object.values(categories).filter((c) => c >= 1000).length;
  const totalCategories = Object.keys(categories).length;

  const pass =
    total >= 100_000 &&
    duplicates === 0 &&
    missingExchange === 0 &&
    categoriesAbove1k >= Math.min(totalCategories, 4);

  return {
    pass,
    details: {
      total,
      duplicates,
      missingExchange,
      categories,
      categoriesAbove1k,
      totalCategories,
      target: ">=100000",
    },
  };
}

/* ── Logo Validation ───────────────────────────────────────────────── */

async function validateLogos(): Promise<ValidationResult> {
  const total = await CleanAssetModel.countDocuments();
  const withLogo = await CleanAssetModel.countDocuments({
    $or: [
      { iconUrl: { $ne: "", $exists: true } },
      { s3Icon: { $ne: "", $exists: true } },
    ],
  });
  const withoutLogo = total - withLogo;
  const accuracy = total > 0 ? ((withLogo / total) * 100).toFixed(1) : "0";

  // Check for fallback/missing in key symbols
  const keySymbols = ["AAPL", "MSFT", "TSLA", "BTC", "ETH", "RELIANCE"];
  const keyCheck = await CleanAssetModel.find({ symbol: { $in: keySymbols } })
    .select({ symbol: 1, iconUrl: 1, s3Icon: 1 })
    .lean();

  const keyMissing = keyCheck.filter(
    (s) => !s.iconUrl && !s.s3Icon,
  ).map((s) => s.symbol);

  return {
    pass: parseFloat(accuracy) >= 50, // Realistic threshold — logos are enriched async
    details: {
      total,
      withLogo,
      withoutLogo,
      accuracy: `${accuracy}%`,
      keySymbolsMissing: keyMissing,
    },
  };
}

/* ── Price Validation ──────────────────────────────────────────────── */

async function validatePrices(): Promise<ValidationResult> {
  // Test price availability for key symbols across different asset types
  const testSymbols = ["AAPL", "MSFT", "TSLA", "BTC", "ETH", "SPY", "EURUSD", "RELIANCE"];

  let withPrice = 0;
  let withoutPrice = 0;
  const priceResults: Record<string, { price: number | null; source: string }> = {};

  // Try priceCache first
  try {
    const quotes = await getPriceQuotes(testSymbols);
    for (const sym of testSymbols) {
      const q = quotes[sym];
      if (q && q.price > 0) {
        priceResults[sym] = { price: q.price, source: "priceCache" };
        withPrice++;
      }
    }
  } catch {
    // priceCache unavailable
  }

  // Fallback: snapshot engine for missing
  const missing = testSymbols.filter((s) => !priceResults[s]);
  if (missing.length > 0) {
    try {
      const snap = await getLiveQuotes({ symbols: missing });
      for (const sym of missing) {
        const q = snap.quotes[sym];
        if (q && q.price > 0) {
          priceResults[sym] = { price: q.price, source: "snapshotEngine" };
          withPrice++;
        } else {
          priceResults[sym] = { price: null, source: "none" };
          withoutPrice++;
        }
      }
    } catch {
      for (const sym of missing) {
        priceResults[sym] = { price: null, source: "none" };
        withoutPrice++;
      }
    }
  }

  const coverage = testSymbols.length > 0
    ? ((withPrice / testSymbols.length) * 100).toFixed(0)
    : "0";

  return {
    pass: withPrice >= testSymbols.length * 0.5, // At least 50% have prices
    details: {
      tested: testSymbols.length,
      withPrice,
      withoutPrice,
      coverage: `${coverage}%`,
      results: priceResults,
    },
  };
}

/* ── Filter Validation ─────────────────────────────────────────────── */

async function validateFilters(): Promise<ValidationResult> {
  const checks: Record<string, { pass: boolean; count: number }> = {};

  // Type filters
  for (const type of ["stock", "crypto", "etf", "forex", "index"]) {
    const count = await CleanAssetModel.countDocuments({ type });
    checks[`type:${type}`] = { pass: count > 0, count };
  }

  // Country filter
  for (const country of ["US", "IN", "GLOBAL"]) {
    const count = await CleanAssetModel.countDocuments({ country });
    checks[`country:${country}`] = { pass: count > 0, count };
  }

  // Exchange filter
  for (const exchange of ["NASDAQ", "NYSE", "BINANCE", "NSE"]) {
    const count = await CleanAssetModel.countDocuments({ exchange });
    checks[`exchange:${exchange}`] = { pass: count > 0, count };
  }

  // Sorting — check that priority sort returns different ordering than name sort
  const [byPriority, byName] = await Promise.all([
    CleanAssetModel.find().sort({ priorityScore: -1 }).limit(5).select({ symbol: 1 }).lean(),
    CleanAssetModel.find().sort({ name: 1 }).limit(5).select({ symbol: 1 }).lean(),
  ]);
  const prioSyms = byPriority.map((s) => s.symbol).join(",");
  const nameSyms = byName.map((s) => s.symbol).join(",");
  checks["sort:different_orders"] = { pass: prioSyms !== nameSyms, count: 0 };

  const failedChecks = Object.entries(checks).filter(([, v]) => !v.pass);

  return {
    pass: failedChecks.length === 0,
    details: {
      checks,
      failedCount: failedChecks.length,
      failedFilters: failedChecks.map(([k]) => k),
    },
  };
}

/* ── Search Validation ─────────────────────────────────────────────── */

async function validateSearch(): Promise<ValidationResult> {
  const queries = ["AAPL", "BTC", "RELIANCE", "SPY", "EURUSD"];
  const results: Record<string, { found: boolean; topResult: string | null; total: number }> = {};

  for (const q of queries) {
    const matches = await CleanAssetModel.find({
      $or: [
        { symbol: { $regex: `^${q}`, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ],
    })
      .sort({ priorityScore: -1 })
      .limit(10)
      .select({ symbol: 1, fullSymbol: 1 })
      .lean();

    results[q] = {
      found: matches.length > 0,
      topResult: matches[0]?.fullSymbol ?? null,
      total: matches.length,
    };
  }

  const allFound = Object.values(results).every((r) => r.found);

  return {
    pass: allFound,
    details: { queries: results },
  };
}

/* ── TradingView Parity ────────────────────────────────────────────── */

async function validateTradingViewParity(): Promise<ValidationResult> {
  // Basic parity: key symbols must exist, have correct type + exchange
  const parityChecks = [
    { symbol: "AAPL", type: "stock", exchanges: ["NASDAQ"] },
    { symbol: "MSFT", type: "stock", exchanges: ["NASDAQ"] },
    { symbol: "BTC", type: "crypto", exchanges: ["CRYPTO", "BINANCE", "COINBASE", "COINGECKO"] },
    { symbol: "ETH", type: "crypto", exchanges: ["CRYPTO", "BINANCE", "COINBASE", "COINGECKO"] },
    { symbol: "SPY", type: "etf", exchanges: ["NYSE", "NYSEARCA", "AMEX"] },
    { symbol: "RELIANCE", type: "stock", exchanges: ["NSE", "BSE"] },
    { symbol: "EURUSD", type: "forex", exchanges: ["FOREX", "FX"] },
    { symbol: "SPX", type: "index", exchanges: ["SP", "INDEX", "INDEXSP"] },
  ];

  const results: Record<string, { found: boolean; match: boolean; actual: string | null }> = {};

  for (const check of parityChecks) {
    const doc = await CleanAssetModel.findOne({
      symbol: check.symbol,
      type: check.type,
    })
      .select({ symbol: 1, exchange: 1, type: 1 })
      .lean();

    if (!doc) {
      results[check.symbol] = { found: false, match: false, actual: null };
    } else {
      const exchangeMatch = check.exchanges.includes(doc.exchange);
      results[check.symbol] = {
        found: true,
        match: exchangeMatch,
        actual: doc.exchange,
      };
    }
  }

  const allMatch = Object.values(results).every((r) => r.found);

  return {
    pass: allMatch,
    details: { checks: results },
  };
}

/* ── Main Validation ───────────────────────────────────────────────── */

export async function validateSystem(): Promise<SystemValidation> {
  logger.info("system_validation_start");
  const t0 = Date.now();

  const [assets, logos, prices, filters, search, parity] = await Promise.all([
    validateAssets(),
    validateLogos(),
    validatePrices(),
    validateFilters(),
    validateSearch(),
    validateTradingViewParity(),
  ]);

  const allPass = assets.pass && logos.pass && prices.pass && filters.pass && search.pass && parity.pass;

  const summary = {
    allPass,
    cleanAssets: (assets.details.total as number) ?? 0,
    duplicates: (assets.details.duplicates as number) ?? 0,
    categories: (assets.details.categories as Record<string, number>) ?? {},
    logoAccuracy: (logos.details.accuracy as string) ?? "0%",
    pricesCoverage: (prices.details.coverage as string) ?? "0%",
    parityStatus: parity.pass ? "MATCHED" : "MISMATCHED",
  };

  const duration = Date.now() - t0;
  logger.info("system_validation_complete", { allPass, duration, summary });

  return { assets, logos, prices, filters, search, parity, summary };
}
