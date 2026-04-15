import { GlobalSymbolMaster } from "../models/GlobalSymbolMaster";
import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";
import { ingestGlobalSymbolsOnce } from "./globalSymbolIngestion.service";
import { markSearchIndexDirty } from "./searchIndex.service";

export type ExpansionCycleStats = {
  coreIngested: number;
  externalIngested: number;
  syntheticIngested: number;
  totalSymbols: number;
  unresolved: number;
};

type ExpansionConfig = {
  targetPerCycle: number;
  maxUniverseSymbols: number;
  baseLimit: number;
};

const DEFAULTS: ExpansionConfig = {
  targetPerCycle: 300000,
  maxUniverseSymbols: 60000,
  baseLimit: 25000,
};

type IngestRow = {
  symbol: string;
  exchange: string;
  name: string;
  type: "stock" | "etf" | "crypto" | "forex" | "index" | "derivative" | "bond" | "economy";
  country: string;
  currency: string;
  source: string;
  iconUrl?: string;
  companyDomain?: string;
  metadata?: Record<string, unknown>;
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function normalizeDomain(domain?: string): string {
  if (!domain) return "";
  try {
    const parsed = new URL(domain.startsWith("http") ? domain : `https://${domain}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function upsertRows(rows: IngestRow[]): Promise<number> {
  if (!rows.length) return 0;

  const normalized = rows
    .map((row) => {
      const symbol = normalizeSymbol(row.symbol);
      const exchange = row.exchange.trim().toUpperCase();
      const fullSymbol = `${exchange}:${symbol}`;
      return {
        symbol,
        fullSymbol,
        exchange,
        name: row.name.trim() || symbol,
        type: row.type,
        country: row.country.trim().toUpperCase() || "GLOBAL",
        currency: row.currency.trim().toUpperCase() || "USD",
        source: row.source,
        iconUrl: row.iconUrl || "",
        companyDomain: normalizeDomain(row.companyDomain),
        marketCap: typeof row.metadata?.marketCap === "number" ? row.metadata.marketCap : 0,
        volume: typeof row.metadata?.volume === "number" ? row.metadata.volume : 0,
        isSynthetic: row.source === "synthetic-derivatives",
        metadata: row.metadata || {},
      };
    })
    .filter((row) => row.symbol.length > 0);

  if (!normalized.length) return 0;

  const now = new Date();
  let upserted = 0;

  for (let i = 0; i < normalized.length; i += 1000) {
    const batch = normalized.slice(i, i + 1000);

    const masterOps = batch.map((row) => ({
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
            logoUrl: row.iconUrl,
            domain: row.companyDomain,
            metadata: row.metadata,
            lastSeenAt: now,
          },
          $setOnInsert: { firstSeenAt: now },
        },
        upsert: true,
      },
    }));

    const symbolOps = batch.map((row) => ({
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
            iconUrl: row.iconUrl,
            companyDomain: row.companyDomain,
            logoValidatedAt: row.iconUrl ? now : undefined,
            logoAttempts: 0,
            lastLogoAttemptAt: Date.now(),
            s3Icon: "",
            popularity: 0,
            searchFrequency: 0,
            userUsage: 0,
            priorityScore: 0,
            marketCap: row.marketCap,
            volume: row.volume,
            liquidityScore: 0,
            isSynthetic: Boolean(row.isSynthetic),
            searchPrefixes: [],
            baseSymbol: row.symbol,
            source: row.source,
          },
        },
        upsert: true,
      },
    }));

    // eslint-disable-next-line no-await-in-loop
    const [masterResult, symbolResult] = await Promise.all([
      GlobalSymbolMaster.bulkWrite(masterOps, { ordered: false }),
      SymbolModel.bulkWrite(symbolOps, { ordered: false }),
    ]);

    upserted += (masterResult.upsertedCount || 0) + (symbolResult.upsertedCount || 0);
  }

  if (upserted > 0) {
    markSearchIndexDirty("global_symbol_expansion");
  }

  return upserted;
}

async function fetchBinanceRows(): Promise<IngestRow[]> {
  try {
    const res = await fetch("https://api.binance.com/api/v3/exchangeInfo", { headers: { "User-Agent": "tradereplay-global-expansion/1.0" } });
    if (!res.ok) return [];
    const payload = await res.json() as { symbols?: Array<{ symbol?: string; status?: string; baseAsset?: string; quoteAsset?: string }> };
    return (payload.symbols || [])
      .filter((row) => row.status === "TRADING" && row.symbol && row.baseAsset && row.quoteAsset)
      .map((row) => ({
        symbol: row.symbol || "",
        exchange: "BINANCE",
        name: `${row.baseAsset}/${row.quoteAsset}`,
        type: "crypto" as const,
        country: "GLOBAL",
        currency: (row.quoteAsset || "USD").toUpperCase(),
        source: "binance-expansion",
        metadata: { baseAsset: row.baseAsset || "", quoteAsset: row.quoteAsset || "" },
      }));
  } catch {
    return [];
  }
}

async function fetchCoinbaseRows(): Promise<IngestRow[]> {
  try {
    const res = await fetch("https://api.exchange.coinbase.com/products", { headers: { "User-Agent": "tradereplay-global-expansion/1.0" } });
    if (!res.ok) return [];
    const payload = await res.json() as Array<{ id?: string; base_currency?: string; quote_currency?: string; status?: string; trading_disabled?: boolean }>;
    return payload
      .filter((row) => row.id && row.base_currency && row.quote_currency && !row.trading_disabled)
      .map((row) => ({
        symbol: (row.id || "").replace(/-/g, ""),
        exchange: "COINBASE",
        name: `${row.base_currency}/${row.quote_currency}`,
        type: "crypto" as const,
        country: "GLOBAL",
        currency: (row.quote_currency || "USD").toUpperCase(),
        source: "coinbase-expansion",
      }));
  } catch {
    return [];
  }
}

async function fetchKrakenRows(): Promise<IngestRow[]> {
  try {
    const res = await fetch("https://api.kraken.com/0/public/AssetPairs", { headers: { "User-Agent": "tradereplay-global-expansion/1.0" } });
    if (!res.ok) return [];
    const payload = await res.json() as { result?: Record<string, { altname?: string; wsname?: string; base?: string; quote?: string }> };
    return Object.values(payload.result || {})
      .filter((row) => Boolean(row.altname || row.wsname))
      .map((row) => ({
        symbol: (row.altname || row.wsname || "").replace(/[\s/]/g, ""),
        exchange: "KRAKEN",
        name: row.wsname || row.altname || "",
        type: "crypto" as const,
        country: "GLOBAL",
        currency: (row.quote || "USD").replace(/^X|^Z/g, "").toUpperCase(),
        source: "kraken-expansion",
      }));
  } catch {
    return [];
  }
}

function buildForexRows(): IngestRow[] {
  const majors = [
    "USD", "EUR", "JPY", "GBP", "AUD", "CAD", "CHF", "NZD", "SEK", "NOK", "DKK", "SGD", "HKD", "CNY", "CNH", "INR",
    "MXN", "BRL", "ZAR", "TRY", "KRW", "TWD", "THB", "MYR", "IDR", "PHP", "PLN", "HUF", "CZK", "RON", "ILS", "AED",
    "SAR", "QAR", "KWD", "BHD", "OMR", "EGP", "PKR", "BDT", "LKR", "VND", "RUB", "UAH", "ARS", "CLP", "COP", "PEN",
    "NGN", "KES", "GHS", "MAD", "DZD", "XAU", "XAG", "BTC", "ETH",
  ];
  const rows: IngestRow[] = [];
  for (const base of majors) {
    for (const quote of majors) {
      if (base === quote) continue;
      rows.push({
        symbol: `${base}${quote}`,
        exchange: "FX",
        name: `${base} / ${quote}`,
        type: "forex",
        country: "GLOBAL",
        currency: quote,
        source: "forex-expansion",
        iconUrl: "https://www.google.com/s2/favicons?domain=xe.com&sz=128",
        companyDomain: "xe.com",
      });
    }
  }
  return rows;
}

async function ingestExternalUniverse(): Promise<number> {
  const [binance, coinbase, kraken] = await Promise.all([
    fetchBinanceRows(),
    fetchCoinbaseRows(),
    fetchKrakenRows(),
  ]);

  const forex = buildForexRows();
  const upserted = await upsertRows([...binance, ...coinbase, ...kraken, ...forex]);
  logger.info("external_universe_ingested", {
    binance: binance.length,
    coinbase: coinbase.length,
    kraken: kraken.length,
    forex: forex.length,
    upserted,
  });

  return upserted;
}

function monthCode(dt: Date): string {
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(base: Date, offset: number): Date {
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  next.setUTCMonth(next.getUTCMonth() + offset);
  return next;
}

async function expandSyntheticUniverse(config: Partial<ExpansionConfig> = {}): Promise<number> {
  if (process.env.DISABLE_SYNTHETIC_EXPANSION === "true") return 0;

  const effective = { ...DEFAULTS, ...config };
  const total = await SymbolModel.estimatedDocumentCount();
  if (total >= effective.maxUniverseSymbols) return 0;

  const bases = await SymbolModel.find({
    iconUrl: { $exists: true, $ne: "" },
    type: { $in: ["stock", "crypto", "index", "forex"] },
  })
    .sort({ searchFrequency: -1, userUsage: -1, priorityScore: -1 })
    .select({ symbol: 1, fullSymbol: 1, name: 1, country: 1, currency: 1, iconUrl: 1, companyDomain: 1 })
    .limit(effective.baseLimit)
    .lean<Array<{ symbol: string; fullSymbol: string; name: string; country: string; currency: string; iconUrl: string; companyDomain?: string }>>();

  const generated: IngestRow[] = [];
  const now = new Date();

  for (const base of bases) {
    const root = normalizeSymbol(base.symbol);
    if (!root) continue;

    for (let m = 1; m <= 12; m += 1) {
      const code = monthCode(addMonths(now, m));
      generated.push({
        symbol: `${root}-F-${code}`,
        exchange: "DERIV",
        name: `${base.name} Future ${code}`,
        type: "derivative",
        country: base.country,
        currency: base.currency,
        source: "synthetic-derivatives",
        iconUrl: base.iconUrl,
        companyDomain: base.companyDomain || "",
        metadata: { parentFullSymbol: base.fullSymbol, instrumentClass: "future" },
      });
    }

    for (let m = 1; m <= 12; m += 1) {
      const code = monthCode(addMonths(now, m));
      for (const side of ["C", "P"] as const) {
        for (const strike of [-30, -20, -10, -5, 0, 5, 10, 20, 30]) {
          generated.push({
            symbol: `${root}-${code}-${side}-${strike}`,
            exchange: "OPT",
            name: `${base.name} Option ${side} ${strike}% ${code}`,
            type: "derivative",
            country: base.country,
            currency: base.currency,
            source: "synthetic-derivatives",
            iconUrl: base.iconUrl,
            companyDomain: base.companyDomain || "",
            metadata: { parentFullSymbol: base.fullSymbol, instrumentClass: "option", side, strikePercent: strike },
          });
        }
      }
    }

    generated.push({
      symbol: root,
      exchange: "CFD",
      name: `${base.name} CFD`,
      type: "derivative",
      country: base.country,
      currency: base.currency,
      source: "synthetic-derivatives",
      iconUrl: base.iconUrl,
      companyDomain: base.companyDomain || "",
      metadata: { parentFullSymbol: base.fullSymbol, instrumentClass: "cfd" },
    });

    if (generated.length >= effective.targetPerCycle) break;
  }

  const inserted = await upsertRows(generated.slice(0, effective.targetPerCycle));
  logger.info("synthetic_universe_expanded", {
    generated: Math.min(generated.length, effective.targetPerCycle),
    inserted,
  });

  return inserted;
}

export async function runGlobalExpansionCycle(config: Partial<ExpansionConfig> = {}): Promise<ExpansionCycleStats> {
  const coreIngest = await ingestGlobalSymbolsOnce();

  const externalIngested = await ingestExternalUniverse();
  const syntheticIngested = await expandSyntheticUniverse(config);

  const [totalSymbols, unresolved] = await Promise.all([
    SymbolModel.estimatedDocumentCount(),
    SymbolModel.countDocuments({ $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }] }),
  ]);

  return {
    coreIngested: coreIngest.symbols,
    externalIngested,
    syntheticIngested,
    totalSymbols,
    unresolved,
  };
}

export async function runInfiniteGlobalExpansionLoop(options: {
  intervalMs?: number;
  targetPerCycle?: number;
  maxUniverseSymbols?: number;
  baseLimit?: number;
} = {}): Promise<void> {
  const intervalMs = options.intervalMs ?? 60000;

  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const stats = await runGlobalExpansionCycle({
        targetPerCycle: options.targetPerCycle,
        maxUniverseSymbols: options.maxUniverseSymbols,
        baseLimit: options.baseLimit,
      });
      logger.info("global_expansion_cycle_complete", stats);
    } catch (error) {
      logger.error("global_expansion_cycle_failed", {
        message: String(error),
      });
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}