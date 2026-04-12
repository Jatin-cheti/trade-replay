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

// ── Source: FMP per-exchange screener for deeper coverage ────────────────

export async function expandFmpDeepScreener(): Promise<ExpansionResult[]> {
  const results: ExpansionResult[] = [];
  const MARKET_CAPS = ["Large", "Mid", "Small", "Micro", "Nano"];

  for (const cap of MARKET_CAPS) {
    if (!isFmpAvailable()) {
      results.push(fmpSkippedResult(`fmp-screener-${cap.toLowerCase()}`));
      break;
    }
    const start = Date.now();
    const url = fmpUrl(`/api/v3/stock-screener?marketCapMoreThan=0&marketCapLessThan=999999999999999&limit=100000&isActivelyTrading=true`);
    if (!url) break;

    try {
      const list = await fetchJson<Array<{ symbol: string; companyName?: string; exchangeShortName?: string; country?: string; sector?: string; industry?: string; marketCap?: number }>>(url);
      const symbols: RawSymbol[] = list
        .filter((item) => item.symbol && item.companyName)
        .map((item) => {
          const exchange = (item.exchangeShortName || "GLOBAL").toUpperCase();
          const country = item.country?.toUpperCase() || deriveCountry(exchange);
          return {
            symbol: item.symbol.toUpperCase(),
            fullSymbol: `${exchange}:${item.symbol.toUpperCase()}`,
            name: item.companyName || item.symbol,
            exchange,
            country,
            type: "stock",
            currency: deriveCurrency(country),
            source: `fmp-screener-${cap.toLowerCase()}`,
            metadata: { sector: item.sector, industry: item.industry, marketCap: item.marketCap },
          };
        });

      const { inserted, skipped } = await upsertToGlobalMaster(symbols);
      results.push({ source: `fmp-screener-${cap.toLowerCase()}`, fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start });
    } catch (error) {
      tripFmpCircuit(error);
      logger.warn(`expansion_fmp_screener_${cap}_failed`, { error: error instanceof Error ? error.message : String(error) });
      results.push({ source: `fmp-screener-${cap.toLowerCase()}`, fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start });
    }

    await new Promise((r) => setTimeout(r, 1000));
    break;
  }

  return results;
}