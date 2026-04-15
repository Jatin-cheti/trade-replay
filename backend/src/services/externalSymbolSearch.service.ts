import { GlobalSymbolMaster } from "../models/GlobalSymbolMaster";
import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";
import { buildCountryFilterInput, matchesCountryFlexible } from "./symbol.helpers";

type ExternalType = "stock" | "etf" | "crypto" | "forex" | "index";

export type ExternalSymbolCandidate = {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: ExternalType;
  currency: string;
  iconUrl?: string;
  companyDomain?: string;
  source: string;
  marketCap?: number;
  volume?: number;
  popularity?: number;
  rankScore: number;
};

type YahooQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  exchDisp?: string;
  quoteType?: string;
  typeDisp?: string;
  isYahooFinance?: boolean;
  region?: string;
  market?: string;
};

type CoinGeckoSearchResponse = {
  coins?: Array<{
    id?: string;
    name?: string;
    symbol?: string;
    market_cap_rank?: number;
    thumb?: string;
    large?: string;
  }>;
};

const EXCHANGE_BOOST: Record<string, Record<string, number>> = {
  IN: { NSE: 1600, BSE: 1300 },
  US: { NASDAQ: 1300, NYSE: 1300, AMEX: 900 },
  GB: { LSE: 1100 },
  GLOBAL: { CRYPTO: 500, FX: 450 },
};

const TOP_COMPANY_BOOST: Record<string, number> = {
  RELIANCE: 2200,
  TCS: 2100,
  HDFCBANK: 2050,
  INFY: 2000,
  ICICIBANK: 1980,
  AAPL: 2200,
  MSFT: 2160,
  AMZN: 2120,
  GOOG: 2100,
  GOOGL: 2100,
  NVDA: 2060,
  BTC: 2200,
  ETH: 2100,
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function normalizeToken(value: string): string {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function buildSearchPrefixes(symbol: string, name: string): string[] {
  const tokens = [normalizeToken(symbol), normalizeToken(name).split(" ")[0] || ""]
    .filter(Boolean);
  const prefixes = new Set<string>();

  for (const token of tokens) {
    for (let length = 1; length <= 4; length += 1) {
      if (token.length >= length) {
        prefixes.add(token.slice(0, length));
      }
    }
  }

  return Array.from(prefixes);
}

function normalizeDomain(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return undefined;
  try {
    const parsed = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function inferTypeFromYahooQuote(quote: YahooQuote): ExternalType | null {
  const quoteType = String(quote.quoteType || quote.typeDisp || "").toUpperCase();
  if (quoteType.includes("CRYPTO")) return "crypto";
  if (quoteType.includes("CURRENCY")) return "forex";
  if (quoteType.includes("ETF") || quoteType.includes("FUND")) return "etf";
  if (quoteType.includes("INDEX")) return "index";
  if (quoteType.includes("EQUITY") || quoteType.includes("MUTUAL")) return "stock";
  return null;
}

function inferCountryFromSymbol(symbol: string, region?: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith(".NS")) return "IN";
  if (upper.endsWith(".BO")) return "IN";
  if (upper.endsWith("=X")) return "GLOBAL";

  const normalizedRegion = String(region || "").trim().toUpperCase();
  if (normalizedRegion === "IN") return "IN";
  if (normalizedRegion === "US") return "US";
  if (normalizedRegion === "GB") return "GB";
  if (normalizedRegion === "EU") return "EU";
  return "US";
}

function inferExchange(symbol: string, quote: YahooQuote, inferredType: ExternalType): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith(".NS")) return "NSE";
  if (upper.endsWith(".BO")) return "BSE";
  if (upper.endsWith("=X") || inferredType === "forex") return "FX";
  if (inferredType === "crypto") return "CRYPTO";
  return String(quote.exchDisp || quote.exchange || "GLOBAL").toUpperCase().replace(/\s+/g, "");
}

function cleanedSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/\.NS$/, "").replace(/\.BO$/, "").replace(/=X$/, "");
}

function stringContainsFuzzy(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  if (haystack.includes(needle)) return true;
  let matched = 0;
  for (let i = 0; i < haystack.length && matched < needle.length; i += 1) {
    if (haystack[i] === needle[matched]) matched += 1;
  }
  return matched >= Math.max(2, Math.floor(needle.length * 0.7));
}

function matchScore(candidate: ExternalSymbolCandidate, query: string): number {
  const q = normalizeToken(query);
  const symbol = normalizeToken(candidate.symbol);
  const name = normalizeToken(candidate.name);

  if (symbol === q) return 10000;
  if (symbol.startsWith(q)) return 5000;
  if (name.includes(q)) return 2000;
  if (stringContainsFuzzy(name, q) || stringContainsFuzzy(symbol, q)) return 500;
  return 0;
}

function geoScore(candidate: ExternalSymbolCandidate, country?: string): number {
  if (!country) return 0;
  const requested = buildCountryFilterInput(country);
  if (!requested) return 0;
  return matchesCountryFlexible(candidate.country, candidate.exchange, requested.code) ? 5000 : -3000;
}

function exchangeScore(candidate: ExternalSymbolCandidate, country?: string): number {
  const key = (country || "GLOBAL").toUpperCase();
  const map = EXCHANGE_BOOST[key] || EXCHANGE_BOOST.GLOBAL || {};
  return map[candidate.exchange] || 0;
}

function popularityScore(candidate: ExternalSymbolCandidate): number {
  const marketCap = Number(candidate.marketCap || 0);
  const volume = Number(candidate.volume || 0);
  const pop = Number(candidate.popularity || 0);
  return Math.round(Math.log10(marketCap + 1) * 180 + Math.log10(volume + 1) * 80 + pop * 25);
}

function topCompanyScore(candidate: ExternalSymbolCandidate): number {
  return TOP_COMPANY_BOOST[normalizeToken(candidate.symbol)] || 0;
}

function finalScore(candidate: ExternalSymbolCandidate, query: string, country?: string): number {
  return (
    matchScore(candidate, query)
    + geoScore(candidate, country)
    + exchangeScore(candidate, country)
    + popularityScore(candidate)
    + topCompanyScore(candidate)
  );
}

async function fetchYahooCandidates(query: string): Promise<ExternalSymbolCandidate[]> {
  const endpoint = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=40&newsCount=0`;
  const response = await fetch(endpoint, {
    headers: { "User-Agent": "trade-replay-external-search/1.0" },
  });
  if (!response.ok) return [];

  const payload = await response.json() as { quotes?: YahooQuote[] };
  const quotes = Array.isArray(payload.quotes) ? payload.quotes : [];

  return quotes
    .map((quote) => {
      const rawSymbol = String(quote.symbol || "").trim();
      const inferredType = inferTypeFromYahooQuote(quote);
      if (!rawSymbol || !inferredType) return null;

      const symbol = cleanedSymbol(rawSymbol);
      const exchange = inferExchange(rawSymbol, quote, inferredType);
      const country = inferCountryFromSymbol(rawSymbol, quote.region);
      const name = String(quote.longname || quote.shortname || symbol).trim();

      return {
        symbol,
        fullSymbol: `${exchange}:${symbol}`,
        name,
        exchange,
        country,
        type: inferredType,
        currency: inferredType === "forex" ? symbol.slice(3, 6) || "USD" : "USD",
        source: "external-yahoo",
        rankScore: 0,
      } satisfies ExternalSymbolCandidate;
    })
    .filter(isDefined);
}

async function fetchCoinGeckoCandidates(query: string): Promise<ExternalSymbolCandidate[]> {
  const endpoint = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
  const response = await fetch(endpoint, {
    headers: { "User-Agent": "trade-replay-external-search/1.0" },
  });
  if (!response.ok) return [];

  const payload = await response.json() as CoinGeckoSearchResponse;
  const coins = Array.isArray(payload.coins) ? payload.coins : [];

  return coins
    .slice(0, 30)
    .map((coin) => {
      const symbol = normalizeToken(String(coin.symbol || ""));
      const name = String(coin.name || symbol).trim();
      if (!symbol || !name) return null;
      return {
        symbol,
        fullSymbol: `CRYPTO:${symbol}`,
        name,
        exchange: "CRYPTO",
        country: "GLOBAL",
        type: "crypto",
        currency: "USD",
        iconUrl: coin.large || coin.thumb || "",
        source: "external-coingecko",
        popularity: typeof coin.market_cap_rank === "number" ? Math.max(0, 1000 - coin.market_cap_rank) : 0,
        rankScore: 0,
      } satisfies ExternalSymbolCandidate;
    })
    .filter(isDefined);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("EXTERNAL_SEARCH_TIMEOUT")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function dedupeByFullSymbol(candidates: ExternalSymbolCandidate[]): ExternalSymbolCandidate[] {
  const map = new Map<string, ExternalSymbolCandidate>();
  for (const candidate of candidates) {
    const key = candidate.fullSymbol.toUpperCase();
    const existing = map.get(key);
    if (!existing || (candidate.rankScore > existing.rankScore)) {
      map.set(key, candidate);
    }
  }
  return Array.from(map.values());
}

export async function fetchExternalSymbols(
  query: string,
  options: { country?: string; type?: string; limit?: number } = {},
): Promise<ExternalSymbolCandidate[]> {
  const trimmedQuery = String(query || "").trim();
  if (!trimmedQuery) return [];

  const limit = Math.max(5, Math.min(100, options.limit ?? 20));
  const normalizedType = String(options.type || "").toLowerCase();

  const tasks: Array<Promise<ExternalSymbolCandidate[]>> = [
    withTimeout(fetchYahooCandidates(trimmedQuery), 3000).catch(() => []),
    withTimeout(fetchCoinGeckoCandidates(trimmedQuery), 3000).catch(() => []),
  ];

  const settled = await Promise.allSettled(tasks);
  const merged = settled
    .flatMap((entry) => (entry.status === "fulfilled" ? entry.value : []))
    .filter((candidate) => {
      if (normalizedType && normalizedType !== "all") {
        if (normalizedType === "funds") return candidate.type === "etf";
        if (normalizedType === "stocks") return candidate.type === "stock";
        if (normalizedType === "indices") return candidate.type === "index";
        if (normalizedType === "futures" || normalizedType === "options") return false;
        if (candidate.type !== normalizedType) return false;
      }
      if (options.country && !matchesCountryFlexible(candidate.country, candidate.exchange, options.country)) {
        return false;
      }
      return true;
    })
    .map((candidate) => ({
      ...candidate,
      rankScore: finalScore(candidate, trimmedQuery, options.country),
      companyDomain: normalizeDomain(candidate.companyDomain),
    }));

  const deduped = dedupeByFullSymbol(merged)
    .sort((left, right) => right.rankScore - left.rankScore)
    .slice(0, limit);

  return deduped;
}

export function persistExternalSymbolsAsync(candidates: ExternalSymbolCandidate[]): void {
  if (!candidates.length) return;
  setImmediate(() => {
    void persistExternalSymbols(candidates).catch((error) => {
      logger.warn("external_symbol_persist_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

async function persistExternalSymbols(candidates: ExternalSymbolCandidate[]): Promise<void> {
  const now = new Date();
  const rows = candidates.slice(0, 100);
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
          logoUrl: row.iconUrl || "",
          domain: row.companyDomain || "",
          metadata: {
            rankScore: row.rankScore,
            marketCap: row.marketCap || 0,
            volume: row.volume || 0,
            external: true,
          },
          lastSeenAt: now,
        },
        $setOnInsert: { firstSeenAt: now },
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
          iconUrl: row.iconUrl || "",
          companyDomain: row.companyDomain || "",
          s3Icon: "",
          popularity: Math.max(0, Math.floor((row.popularity || 0) + Math.max(0, row.rankScore / 100))),
          searchFrequency: 1,
          userUsage: 0,
          priorityScore: Math.max(1, Math.floor(row.rankScore / 100)),
          marketCap: row.marketCap || 0,
          volume: row.volume || 0,
          liquidityScore: 0,
          isSynthetic: false,
          baseSymbol: row.symbol,
          searchPrefixes: buildSearchPrefixes(row.symbol, row.name),
          source: row.source,
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
