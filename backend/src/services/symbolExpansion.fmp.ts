import {
  type RawSymbol,
  type ExpansionResult,
  isFmpAvailable,
  tripFmpCircuit,
  fmpSkippedResult,
  fmpUrl,
  fetchJson,
  deriveCountry,
  deriveCurrency,
  inferType,
  upsertToGlobalMaster,
} from "./symbolExpansion.helpers";
import { logger } from "../utils/logger";

// ── Source: FMP Full Stock List ──────────────────────────────────────────

interface FmpStockItem {
  symbol: string;
  name: string;
  price?: number;
  exchange?: string;
  exchangeShortName?: string;
  type?: string;
}

export async function expandFmpStocks(): Promise<ExpansionResult> {
  const start = Date.now();
  if (!isFmpAvailable()) return fmpSkippedResult("fmp-stocks");
  const url = fmpUrl("/api/v3/stock/list");
  if (!url) return fmpSkippedResult("fmp-stocks");

  try {
    const list = await fetchJson<FmpStockItem[]>(url);
    const symbols: RawSymbol[] = list
      .filter((item) => item.symbol && item.name)
      .map((item) => {
        const exchange = (item.exchangeShortName || item.exchange || "GLOBAL").toUpperCase();
        const country = deriveCountry(exchange);
        return {
          symbol: item.symbol.toUpperCase(),
          fullSymbol: `${exchange}:${item.symbol.toUpperCase()}`,
          name: item.name,
          exchange,
          country,
          type: "stock",
          currency: deriveCurrency(country),
          source: "fmp-stock-list",
        };
      });

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "fmp-stocks", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("expansion_fmp_stocks_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "fmp-stocks", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: FMP ETF List ─────────────────────────────────────────────────

export async function expandFmpEtfs(): Promise<ExpansionResult> {
  const start = Date.now();
  if (!isFmpAvailable()) return fmpSkippedResult("fmp-etfs");
  const url = fmpUrl("/api/v3/etf/list");
  if (!url) return fmpSkippedResult("fmp-etfs");

  try {
    const list = await fetchJson<FmpStockItem[]>(url);
    const symbols: RawSymbol[] = list
      .filter((item) => item.symbol && item.name)
      .map((item) => {
        const exchange = (item.exchangeShortName || item.exchange || "GLOBAL").toUpperCase();
        const country = deriveCountry(exchange);
        return {
          symbol: item.symbol.toUpperCase(),
          fullSymbol: `${exchange}:${item.symbol.toUpperCase()}`,
          name: item.name,
          exchange,
          country,
          type: "etf",
          currency: deriveCurrency(country),
          source: "fmp-etf-list",
        };
      });

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "fmp-etfs", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("expansion_fmp_etfs_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "fmp-etfs", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: FMP Available Traded ─────────────────────────────────────────

export async function expandFmpAvailableTraded(): Promise<ExpansionResult> {
  const start = Date.now();
  if (!isFmpAvailable()) return fmpSkippedResult("fmp-traded");
  const url = fmpUrl("/api/v3/available-traded/list");
  if (!url) return fmpSkippedResult("fmp-traded");

  try {
    const list = await fetchJson<FmpStockItem[]>(url);
    const symbols: RawSymbol[] = list
      .filter((item) => item.symbol && item.name)
      .map((item) => {
        const exchange = (item.exchangeShortName || item.exchange || "GLOBAL").toUpperCase();
        const country = deriveCountry(exchange);
        const type = inferType(item.type, item.name, exchange);
        return {
          symbol: item.symbol.toUpperCase(),
          fullSymbol: `${exchange}:${item.symbol.toUpperCase()}`,
          name: item.name,
          exchange,
          country,
          type,
          currency: deriveCurrency(country),
          source: "fmp-available-traded",
        };
      });

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "fmp-traded", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("expansion_fmp_traded_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "fmp-traded", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: FMP Crypto ───────────────────────────────────────────────────

interface FmpCryptoItem {
  symbol: string;
  name: string;
  currency?: string;
  stockExchange?: string;
  exchangeShortName?: string;
}

export async function expandFmpCrypto(): Promise<ExpansionResult> {
  const start = Date.now();
  if (!isFmpAvailable()) return fmpSkippedResult("fmp-crypto");
  const url = fmpUrl("/api/v3/symbol/available-cryptocurrencies");
  if (!url) return fmpSkippedResult("fmp-crypto");

  try {
    const list = await fetchJson<FmpCryptoItem[]>(url);
    const symbols: RawSymbol[] = list
      .filter((item) => item.symbol && item.name)
      .map((item) => ({
        symbol: item.symbol.toUpperCase(),
        fullSymbol: `CRYPTO:${item.symbol.toUpperCase()}`,
        name: item.name,
        exchange: (item.exchangeShortName || "CRYPTO").toUpperCase(),
        country: "GLOBAL",
        type: "crypto",
        currency: item.currency || "USD",
        source: "fmp-crypto",
      }));

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "fmp-crypto", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("expansion_fmp_crypto_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "fmp-crypto", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: FMP Forex ────────────────────────────────────────────────────

export async function expandFmpForex(): Promise<ExpansionResult> {
  const start = Date.now();
  if (!isFmpAvailable()) return fmpSkippedResult("fmp-forex");
  const url = fmpUrl("/api/v3/symbol/available-forex-currency-pairs");
  if (!url) return fmpSkippedResult("fmp-forex");

  try {
    const list = await fetchJson<Array<{ symbol: string; name: string; currency?: string; stockExchange?: string }>>(url);
    const symbols: RawSymbol[] = list
      .filter((item) => item.symbol && item.name)
      .map((item) => ({
        symbol: item.symbol.toUpperCase(),
        fullSymbol: `FX:${item.symbol.toUpperCase()}`,
        name: item.name,
        exchange: "FOREX",
        country: "GLOBAL",
        type: "forex",
        currency: item.currency || item.symbol.slice(0, 3).toUpperCase(),
        source: "fmp-forex",
      }));

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "fmp-forex", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("expansion_fmp_forex_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "fmp-forex", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: FMP Commodities ──────────────────────────────────────────────

export async function expandFmpCommodities(): Promise<ExpansionResult> {
  const start = Date.now();
  if (!isFmpAvailable()) return fmpSkippedResult("fmp-commodities");
  const url = fmpUrl("/api/v3/symbol/available-commodities");
  if (!url) return fmpSkippedResult("fmp-commodities");

  try {
    const list = await fetchJson<Array<{ symbol: string; name: string; currency?: string; stockExchange?: string }>>(url);
    const symbols: RawSymbol[] = list
      .filter((item) => item.symbol && item.name)
      .map((item) => ({
        symbol: item.symbol.toUpperCase(),
        fullSymbol: `COMMODITY:${item.symbol.toUpperCase()}`,
        name: item.name,
        exchange: "COMMODITY",
        country: "GLOBAL",
        type: "commodity",
        currency: item.currency || "USD",
        source: "fmp-commodities",
      }));

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "fmp-commodities", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("expansion_fmp_commodities_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "fmp-commodities", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: FMP Exchange-specific stock lists ────────────────────────────

const EXCHANGE_STOCK_ENDPOINTS: Array<{ exchange: string; country: string; currency: string }> = [
  { exchange: "LSE", country: "GB", currency: "GBP" },
  { exchange: "XETRA", country: "DE", currency: "EUR" },
  { exchange: "EURONEXT", country: "EU", currency: "EUR" },
  { exchange: "TSE", country: "JP", currency: "JPY" },
  { exchange: "HKEX", country: "HK", currency: "HKD" },
  { exchange: "ASX", country: "AU", currency: "AUD" },
  { exchange: "TSX", country: "CA", currency: "CAD" },
  { exchange: "JSE", country: "ZA", currency: "ZAR" },
  { exchange: "KRX", country: "KR", currency: "KRW" },
  { exchange: "SGX", country: "SG", currency: "SGD" },
  { exchange: "SIX", country: "CH", currency: "CHF" },
  { exchange: "BME", country: "ES", currency: "EUR" },
  { exchange: "MIL", country: "IT", currency: "EUR" },
  { exchange: "SAU", country: "SA", currency: "SAR" },
  { exchange: "TAI", country: "TW", currency: "TWD" },
];

export async function expandFmpExchangeStocks(): Promise<ExpansionResult[]> {
  const results: ExpansionResult[] = [];

  for (const config of EXCHANGE_STOCK_ENDPOINTS) {
    if (!isFmpAvailable()) {
      results.push(fmpSkippedResult(`fmp-${config.exchange}`));
      continue;
    }
    const start = Date.now();
    const url = fmpUrl(`/api/v3/stock-screener?exchange=${config.exchange}&limit=100000`);
    if (!url) {
      results.push(fmpSkippedResult(`fmp-${config.exchange}`));
      continue;
    }

    try {
      const list = await fetchJson<Array<{ symbol: string; companyName?: string; exchangeShortName?: string; sector?: string; industry?: string }>>(url);
      const symbols: RawSymbol[] = list
        .filter((item) => item.symbol)
        .map((item) => ({
          symbol: item.symbol.toUpperCase(),
          fullSymbol: `${config.exchange}:${item.symbol.toUpperCase()}`,
          name: item.companyName || item.symbol,
          exchange: config.exchange,
          country: config.country,
          type: "stock",
          currency: config.currency,
          source: `fmp-exchange-${config.exchange.toLowerCase()}`,
          metadata: { sector: item.sector, industry: item.industry },
        }));

      const { inserted, skipped } = await upsertToGlobalMaster(symbols);
      results.push({ source: `fmp-${config.exchange}`, fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start });
    } catch (error) {
      tripFmpCircuit(error);
      logger.warn(`expansion_fmp_${config.exchange}_failed`, { error: error instanceof Error ? error.message : String(error) });
      results.push({ source: `fmp-${config.exchange}`, fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start });
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}

// ── Source: FMP Bonds ───────────────────────────────────────────────────

interface FmpBondItem {
  symbol: string;
  name: string;
  currency?: string;
  exchange?: string;
  type?: string;
}

export async function expandFmpBonds(): Promise<ExpansionResult> {
  const start = Date.now();
  if (!isFmpAvailable()) return fmpSkippedResult("fmp-bonds");
  const url = fmpUrl("/api/v3/bond/list");
  if (!url) return fmpSkippedResult("fmp-bonds");

  try {
    const list = await fetchJson<FmpBondItem[]>(url);
    const symbols: RawSymbol[] = list
      .filter((item) => item.symbol && item.name)
      .map((item) => {
        const exchange = (item.exchange || "BOND").toUpperCase();
        const country = deriveCountry(exchange);
        return {
          symbol: item.symbol.toUpperCase(),
          fullSymbol: `${exchange}:${item.symbol.toUpperCase()}`,
          name: item.name,
          exchange,
          country,
          type: "bond",
          currency: item.currency || deriveCurrency(country),
          source: "fmp-bonds",
        };
      });

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "fmp-bonds", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("expansion_fmp_bonds_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "fmp-bonds", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: FMP Economy Indicators ───────────────────────────────────────

interface FmpEconomyItem {
  symbol: string;
  name: string;
  country?: string;
  type?: string;
}

export async function expandFmpEconomy(): Promise<ExpansionResult> {
  const start = Date.now();
  if (!isFmpAvailable()) return fmpSkippedResult("fmp-economy");
  const url = fmpUrl("/api/v3/economic-indicators");
  if (!url) return fmpSkippedResult("fmp-economy");

  try {
    const list = await fetchJson<FmpEconomyItem[]>(url);
    const symbols: RawSymbol[] = list
      .filter((item) => item.symbol && item.name)
      .map((item) => {
        const country = item.country?.toUpperCase() || "GLOBAL";
        return {
          symbol: item.symbol.toUpperCase(),
          fullSymbol: `ECONOMY:${item.symbol.toUpperCase()}`,
          name: item.name,
          exchange: "ECONOMY",
          country,
          type: "economy",
          currency: deriveCurrency(country),
          source: "fmp-economy",
        };
      });

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "fmp-economy", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("expansion_fmp_economy_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "fmp-economy", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: FMP Options ──────────────────────────────────────────────────

interface FmpOptionItem {
  symbol: string;
  name: string;
  underlying?: string;
  type?: string;
  expiration?: string;
}

export async function expandFmpOptions(): Promise<ExpansionResult> {
  const start = Date.now();
  if (!isFmpAvailable()) return fmpSkippedResult("fmp-options");
  const url = fmpUrl("/api/v3/options/list");
  if (!url) return fmpSkippedResult("fmp-options");

  try {
    const list = await fetchJson<FmpOptionItem[]>(url);
    const symbols: RawSymbol[] = list
      .filter((item) => item.symbol && item.name)
      .map((item) => {
        const exchange = "OPT";
        const country = "GLOBAL";
        return {
          symbol: item.symbol.toUpperCase(),
          fullSymbol: `${exchange}:${item.symbol.toUpperCase()}`,
          name: item.name,
          exchange,
          country,
          type: "option",
          currency: "USD",
          source: "fmp-options",
          metadata: { underlying: item.underlying, expiration: item.expiration },
        };
      });

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "fmp-options", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("expansion_fmp_options_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "fmp-options", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: FMP Futures ──────────────────────────────────────────────────

interface FmpFutureItem {
  symbol: string;
  name: string;
  underlying?: string;
  type?: string;
  expiration?: string;
}

export async function expandFmpFutures(): Promise<ExpansionResult> {
  const start = Date.now();
  if (!isFmpAvailable()) return fmpSkippedResult("fmp-futures");
  const url = fmpUrl("/api/v3/futures/list");
  if (!url) return fmpSkippedResult("fmp-futures");

  try {
    const list = await fetchJson<FmpFutureItem[]>(url);
    const symbols: RawSymbol[] = list
      .filter((item) => item.symbol && item.name)
      .map((item) => {
        const exchange = "FUT";
        const country = "GLOBAL";
        return {
          symbol: item.symbol.toUpperCase(),
          fullSymbol: `${exchange}:${item.symbol.toUpperCase()}`,
          name: item.name,
          exchange,
          country,
          type: "future",
          currency: "USD",
          source: "fmp-futures",
          metadata: { underlying: item.underlying, expiration: item.expiration },
        };
      });

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "fmp-futures", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("expansion_fmp_futures_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "fmp-futures", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Company Profile Enrichment ───────────────────────────────────────────

export interface FmpCompanyProfile {
  symbol: string;
  price?: number;
  beta?: number;
  volAvg?: number;
  mktCap?: number;
  lastDiv?: number;
  range?: string;
  changes?: number;
  companyName?: string;
  currency?: string;
  cik?: string;
  isin?: string;
  cusip?: string;
  exchange?: string;
  exchangeShortName?: string;
  industry?: string;
  website?: string;
  description?: string;
  ceo?: string;
  sector?: string;
  country?: string;
  fullTimeEmployees?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  dcfDiff?: number;
  dcf?: number;
  image?: string;
  ipoDate?: string;
  defaultImage?: boolean;
  isEtf?: boolean;
  isActivelyTrading?: boolean;
  isAdr?: boolean;
  isFund?: boolean;
}

export interface CompanyProfileEnrichResult {
  symbol: string;
  updated: boolean;
  error?: string;
}

/**
 * Fetch FMP company profile for a single symbol and return the enriched fields.
 * Does NOT write to DB — callers decide whether/how to persist.
 */
export async function fetchFmpCompanyProfile(symbol: string): Promise<FmpCompanyProfile | null> {
  if (!isFmpAvailable()) return null;
  const url = fmpUrl(`/api/v3/profile/${encodeURIComponent(symbol)}`);
  if (!url) return null;

  try {
    const data = await fetchJson<FmpCompanyProfile[]>(url);
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0];
  } catch (error) {
    tripFmpCircuit(error);
    logger.warn("fmp_profile_fetch_failed", { symbol, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Map a raw FMP company profile to clean CleanAsset profile fields.
 */
export function mapFmpProfileToAssetFields(profile: FmpCompanyProfile): Record<string, string | number | null> {
  const hqParts = [profile.address, profile.city, profile.state, profile.country]
    .filter(Boolean)
    .join(", ");

  return {
    industry: profile.industry?.trim() || "",
    ceo: profile.ceo?.trim() || "",
    headquarters: hqParts || "",
    ipoDate: profile.ipoDate?.trim() || "",
    isin: profile.isin?.trim() || "",
    description: profile.description?.trim() || "",
    // sector from FMP can supplement existing sector if missing
    ...(profile.sector ? { sector: profile.sector.trim() } : {}),
    // companyDomain from website
    ...(profile.website ? { companyDomain: profile.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "").trim() } : {}),
  };
}