/**
 * symbolExpansion.yahoo.ts — Yahoo Finance bulk listing expansion
 *
 * Uses Yahoo Finance v8 screener/spark endpoints (free, no key required)
 * to pull symbols from international exchanges.
 */
import {
  type RawSymbol,
  type ExpansionResult,
  upsertToGlobalMaster,
  USER_AGENT,
  FETCH_TIMEOUT_MS,
} from "./symbolExpansion.helpers";
import { logger } from "../utils/logger";

const YAHOO_SCREENER_URL = "https://query2.finance.yahoo.com/v1/finance/screener";
const YAHOO_LOOKUP_URL = "https://query1.finance.yahoo.com/v1/finance/lookup";

async function fetchYahoo<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface YahooQuote {
  symbol?: string;
  shortName?: string;
  longName?: string;
  exchange?: string;
  market?: string;
  quoteType?: string;
  region?: string;
}

function inferExchange(quote: YahooQuote): string {
  const exchange = (quote.exchange || "").toUpperCase();
  const market = (quote.market || "").toLowerCase();

  // Map Yahoo exchange codes to our exchange names
  const EXCHANGE_MAP: Record<string, string> = {
    NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NAS: "NASDAQ",
    NYQ: "NYSE", NYS: "NYSE",
    ASE: "AMEX", AMX: "AMEX",
    BTS: "BATS",
    PCX: "ARCA",
    NSI: "NSE",
    BOM: "BSE",
    LSE: "LSE", LON: "LSE",
    TOR: "TSX", VAN: "TSXV", CNQ: "TSX",
    ASX: "ASX",
    FRA: "FRA", GER: "XETRA", STU: "STU", MUN: "MUN", HAM: "HAM", DUS: "DUS", BER: "BER",
    PAR: "EURONEXT", AMS: "EURONEXT", BRU: "EURONEXT", LIS: "EURONEXT",
    MIL: "MIL", BIT: "MIL",
    MCE: "BME", MAD: "BME",
    SIX: "SIX", EBS: "SIX", VTX: "SIX",
    VIE: "VIE", WSE: "WSE", CPH: "CPH", HEL: "HEL", STO: "STO", OSL: "OSL", ISE: "ISE",
    TAI: "TWSE", TWO: "TPEX",
    KSC: "KOSDAQ", KOE: "KOSDAQ", KOS: "KRX",
    JPX: "JPX", TYO: "TSE",
    HKG: "HKEX",
    SHG: "SSE", SHH: "SSE", SHZ: "SZSE",
    JSE: "JSE",
    SAO: "BOVESPA", SAP: "BOVESPA",
    MEX: "BMV",
    SGX: "SGX", SES: "SGX",
    SET: "SET", BKK: "SET",
    JKT: "IDX",
    KLSE: "KLSE", KLS: "KLSE",
    NZE: "NZX",
    TAD: "TADAWUL",
    QAT: "QSE",
    ADX: "ADX",
    EGY: "EGX",
    BUE: "BCBA",
    SNP: "BCS",
    BOG: "BVC",
    LIM: "BVL",
    PSE: "PSE",
    DSE: "DSE",
    CSE: "CSE",
    DSM: "DSM",
    BAH: "BAH",
    MSW: "MSW",
  };

  return EXCHANGE_MAP[exchange] || exchange || "GLOBAL";
}

function inferCountry(quote: YahooQuote, exchange: string): string {
  const EXCHANGE_COUNTRY: Record<string, string> = {
    NASDAQ: "US", NYSE: "US", AMEX: "US", BATS: "US", ARCA: "US",
    NSE: "IN", BSE: "IN",
    LSE: "GB", TSX: "CA", TSXV: "CA", ASX: "AU",
    FRA: "DE", XETRA: "DE", STU: "DE", MUN: "DE", HAM: "DE", DUS: "DE", BER: "DE",
    EURONEXT: "EU", MIL: "IT", BME: "ES", SIX: "CH", VIE: "AT",
    WSE: "PL", CPH: "DK", HEL: "FI", STO: "SE", OSL: "NO", ISE: "IE",
    TWSE: "TW", TPEX: "TW", KOSDAQ: "KR", KRX: "KR",
    JPX: "JP", TSE: "JP", HKEX: "HK",
    SSE: "CN", SZSE: "CN",
    JSE: "ZA", BOVESPA: "BR", BMV: "MX",
    SGX: "SG", SET: "TH", IDX: "ID", KLSE: "MY",
    NZX: "NZ", TADAWUL: "SA", QSE: "QA", ADX: "AE", EGX: "EG",
    BCBA: "AR", BCS: "CL", BVC: "CO", BVL: "PE",
    PSE: "PH", DSE: "BD", CSE: "LK", DSM: "QA", BAH: "BH", MSW: "RU",
  };
  return EXCHANGE_COUNTRY[exchange] || (quote.region || "GLOBAL").toUpperCase();
}

function inferType(quoteType?: string): string {
  switch ((quoteType || "").toUpperCase()) {
    case "EQUITY": return "stock";
    case "ETF": return "etf";
    case "INDEX": return "index";
    case "CURRENCY": return "forex";
    case "CRYPTOCURRENCY": return "crypto";
    case "MUTUALFUND": return "etf";
    case "FUTURE": return "futures";
    case "OPTION": return "derivative";
    default: return "stock";
  }
}

function deriveCurrency(country: string): string {
  const COUNTRY_CURRENCY: Record<string, string> = {
    US: "USD", IN: "INR", GB: "GBP", CA: "CAD", AU: "AUD",
    DE: "EUR", EU: "EUR", IT: "EUR", ES: "EUR", FR: "EUR",
    AT: "EUR", FI: "EUR", IE: "EUR", NL: "EUR", PT: "EUR", BE: "EUR",
    CH: "CHF", JP: "JPY", HK: "HKD", CN: "CNY", KR: "KRW",
    TW: "TWD", SG: "SGD", TH: "THB", ID: "IDR", MY: "MYR",
    BR: "BRL", MX: "MXN", ZA: "ZAR", SA: "SAR", AE: "AED",
    SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
    NZ: "NZD", PH: "PHP", BD: "BDT", LK: "LKR", QA: "QAR",
    AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
    EG: "EGP", BH: "BHD", RU: "RUB",
  };
  return COUNTRY_CURRENCY[country] || "USD";
}

/**
 * Yahoo Finance lookup endpoint to bulk search symbols by exchange
 * This is the most reliable free method to discover symbols.
 */
async function lookupByExchange(
  exchangeQuery: string,
  targetExchange: string,
  country: string,
  maxResults = 500,
): Promise<RawSymbol[]> {
  const symbols: RawSymbol[] = [];
  const seen = new Set<string>();

  // Search using common prefixes and single letters
  const queries = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

  for (const q of queries) {
    try {
      const url = `${YAHOO_LOOKUP_URL}?formatted=true&lang=en-US&region=US&query=${q}&type=equity&count=100&start=0&corsDomain=finance.yahoo.com`;
      const data = await fetchYahoo<{
        finance?: {
          result?: Array<{
            documents?: Array<YahooQuote>;
          }>;
        };
      }>(url);

      const docs = data?.finance?.result?.[0]?.documents || [];
      for (const quote of docs) {
        if (!quote.symbol) continue;
        const sym = quote.symbol.toUpperCase();
        if (seen.has(sym)) continue;
        seen.add(sym);

        const exchange = inferExchange(quote);
        if (targetExchange && exchange !== targetExchange) continue;

        symbols.push({
          symbol: sym.split(".")[0] || sym,
          fullSymbol: `${exchange}:${sym.split(".")[0] || sym}`,
          name: quote.longName || quote.shortName || sym,
          exchange,
          country: inferCountry(quote, exchange),
          type: inferType(quote.quoteType),
          currency: deriveCurrency(inferCountry(quote, exchange)),
          source: "yahoo-lookup",
        });
      }

      if (symbols.length >= maxResults) break;
      await sleep(200); // rate limit protection
    } catch {
      // skip failed queries
    }
  }

  return symbols;
}

/**
 * Fetch popular/trending symbols from Yahoo Finance
 */
async function fetchYahooTrending(): Promise<RawSymbol[]> {
  try {
    const url = "https://query2.finance.yahoo.com/v1/finance/trending/US?count=50";
    const data = await fetchYahoo<{
      finance?: {
        result?: Array<{
          quotes?: Array<{ symbol: string }>;
        }>;
      };
    }>(url);

    const tickers = data?.finance?.result?.[0]?.quotes || [];
    const symbols: RawSymbol[] = [];

    for (const t of tickers) {
      if (!t.symbol) continue;
      symbols.push({
        symbol: t.symbol.toUpperCase(),
        fullSymbol: `NYSE:${t.symbol.toUpperCase()}`,
        name: t.symbol,
        exchange: "NYSE",
        country: "US",
        type: "stock",
        currency: "USD",
        source: "yahoo-trending",
      });
    }

    return symbols;
  } catch {
    return [];
  }
}

/**
 * Fetch Indian symbols from Yahoo Finance (NSE suffix .NS, BSE suffix .BO)
 */
async function fetchYahooIndian(): Promise<RawSymbol[]> {
  const symbols: RawSymbol[] = [];
  const seen = new Set<string>();

  // Known large-cap Indian symbols to seed search
  const queries = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  for (const q of queries) {
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${q}&quotesCount=50&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query&region=IN`;
      const data = await fetchYahoo<{
        quotes?: Array<YahooQuote & { isYahooFinance?: boolean }>;
      }>(url);

      for (const quote of data?.quotes || []) {
        if (!quote.symbol) continue;
        const raw = quote.symbol;
        const isNse = raw.endsWith(".NS");
        const isBse = raw.endsWith(".BO");
        if (!isNse && !isBse) continue;

        const clean = raw.replace(/\.(NS|BO)$/, "").toUpperCase();
        const exchange = isNse ? "NSE" : "BSE";
        const key = `${exchange}:${clean}`;
        if (seen.has(key)) continue;
        seen.add(key);

        symbols.push({
          symbol: clean,
          fullSymbol: key,
          name: quote.longName || quote.shortName || clean,
          exchange,
          country: "IN",
          type: inferType(quote.quoteType),
          currency: "INR",
          source: "yahoo-india",
        });
      }

      await sleep(300);
    } catch {
      // continue
    }
  }

  return symbols;
}

export async function expandYahooFinance(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    const [trending, indian] = await Promise.all([
      fetchYahooTrending(),
      fetchYahooIndian(),
    ]);

    const all = [...trending, ...indian];
    const { inserted, skipped } = await upsertToGlobalMaster(all);

    logger.info("expansion_yahoo_complete", {
      trending: trending.length,
      indian: indian.length,
      inserted,
    });

    return {
      source: "yahoo-finance",
      fetched: all.length,
      newInserted: inserted,
      existingSkipped: skipped,
      errors: 0,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    logger.warn("expansion_yahoo_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      source: "yahoo-finance",
      fetched: 0,
      newInserted: 0,
      existingSkipped: 0,
      errors: 1,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Fetch CoinMarketCap symbols from their free public listings endpoint
 */
export async function expandCoinMarketCap(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    // CoinMarketCap public API (no key needed for basic listing)
    const url = "https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start=1&limit=5000&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all&audited=false";
    const data = await fetchYahoo<{
      data?: {
        cryptoCurrencyList?: Array<{
          symbol?: string;
          name?: string;
          slug?: string;
          cmcRank?: number;
          quotes?: Array<{
            price?: number;
            volume24h?: number;
            marketCap?: number;
          }>;
        }>;
      };
    }>(url);

    const list = data?.data?.cryptoCurrencyList || [];
    const symbols: RawSymbol[] = list
      .filter((c) => c.symbol && c.name)
      .map((c) => ({
        symbol: (c.symbol || "").toUpperCase(),
        fullSymbol: `CRYPTO:${(c.symbol || "").toUpperCase()}`,
        name: c.name || c.symbol || "",
        exchange: "CRYPTO",
        country: "GLOBAL",
        type: "crypto",
        currency: "USD",
        source: "coinmarketcap",
        metadata: {
          slug: c.slug,
          rank: c.cmcRank,
          marketCap: c.quotes?.[0]?.marketCap || 0,
          volume: c.quotes?.[0]?.volume24h || 0,
        },
      }));

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);

    return {
      source: "coinmarketcap",
      fetched: symbols.length,
      newInserted: inserted,
      existingSkipped: skipped,
      errors: 0,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    logger.warn("expansion_coinmarketcap_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      source: "coinmarketcap",
      fetched: 0,
      newInserted: 0,
      existingSkipped: 0,
      errors: 1,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Expand from Dukascopy (comprehensive forex/CFD list — 5000+ instruments)
 */
export async function expandDukascopyForex(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    const url = "https://freeserv.dukascopy.com/2.0/index.php?path=common%2Finstruments&json";
    const data = await fetchYahoo<Record<string, {
      title?: string;
      description?: string;
      group?: string;
      pipValue?: number;
    }>>(url);

    const symbols: RawSymbol[] = Object.entries(data)
      .filter(([key, val]) => key && val.title)
      .map(([key, val]) => {
        const sym = key.toUpperCase().replace("/", "");
        const group = (val.group || "").toLowerCase();
        let type = "forex";
        if (group.includes("crypto")) type = "crypto";
        else if (group.includes("stock") || group.includes("equity")) type = "stock";
        else if (group.includes("index") || group.includes("indices")) type = "index";
        else if (group.includes("commodity") || group.includes("metal") || group.includes("energy")) type = "futures";

        return {
          symbol: sym,
          fullSymbol: `FX:${sym}`,
          name: val.title || sym,
          exchange: "FX",
          country: "GLOBAL",
          type,
          currency: "USD",
          source: "dukascopy",
        };
      });

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);

    return {
      source: "dukascopy",
      fetched: symbols.length,
      newInserted: inserted,
      existingSkipped: skipped,
      errors: 0,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    logger.warn("expansion_dukascopy_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      source: "dukascopy",
      fetched: 0,
      newInserted: 0,
      existingSkipped: 0,
      errors: 1,
      durationMs: Date.now() - start,
    };
  }
}
