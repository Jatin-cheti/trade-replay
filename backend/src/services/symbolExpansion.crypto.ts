import {
  type RawSymbol,
  type ExpansionResult,
  fetchJson,
  fetchText,
  deriveCountry,
  deriveCurrency,
  inferType,
  upsertToGlobalMaster,
} from "./symbolExpansion.helpers";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// ── Source: CoinGecko Full Coins List ────────────────────────────────────

export async function expandCoinGeckoFull(): Promise<ExpansionResult> {
  const start = Date.now();

  try {
    const coins = await fetchJson<Array<{ id: string; symbol: string; name: string }>>(
      "https://api.coingecko.com/api/v3/coins/list",
    );

    const symbols: RawSymbol[] = coins
      .filter((coin) => coin.symbol && coin.name)
      .map((coin) => ({
        symbol: coin.symbol.toUpperCase(),
        fullSymbol: `CRYPTO:${coin.symbol.toUpperCase()}`,
        name: coin.name,
        exchange: "GLOBAL",
        country: "GLOBAL",
        type: "crypto",
        currency: "USD",
        source: "coingecko-list",
        metadata: { coingeckoId: coin.id },
      }));

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "coingecko-full", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_coingecko_full_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "coingecko-full", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: CoinGecko Extended Markets (paged) ──────────────────────────

export async function expandCoinGeckoMarkets(): Promise<ExpansionResult> {
  const start = Date.now();
  const allSymbols: RawSymbol[] = [];
  const MAX_PAGES = 50;

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const coins = await fetchJson<Array<{ id: string; symbol: string; name: string; image?: string; market_cap_rank?: number }>>(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false`,
      );

      if (coins.length === 0) break;

      for (const coin of coins) {
        if (!coin.symbol || !coin.name) continue;
        allSymbols.push({
          symbol: coin.symbol.toUpperCase(),
          fullSymbol: `CRYPTO:${coin.symbol.toUpperCase()}`,
          name: coin.name,
          exchange: "GLOBAL",
          country: "GLOBAL",
          type: "crypto",
          currency: "USD",
          source: "coingecko-markets",
          logoUrl: coin.image || "",
          metadata: { coingeckoId: coin.id, marketCapRank: coin.market_cap_rank },
        });
      }

      await new Promise((r) => setTimeout(r, 2500));
    }

    const { inserted, skipped } = await upsertToGlobalMaster(allSymbols);
    return { source: "coingecko-markets", fetched: allSymbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_coingecko_markets_failed", { error: error instanceof Error ? error.message : String(error) });
    if (allSymbols.length > 0) {
      const { inserted, skipped } = await upsertToGlobalMaster(allSymbols);
      return { source: "coingecko-markets", fetched: allSymbols.length, newInserted: inserted, existingSkipped: skipped, errors: 1, durationMs: Date.now() - start };
    }
    return { source: "coingecko-markets", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: Binance ALL pairs ────────────────────────────────────────────

export async function expandBinanceFull(): Promise<ExpansionResult> {
  const start = Date.now();

  try {
    const data = await fetchJson<{ symbols?: Array<{ symbol: string; status: string; baseAsset: string; quoteAsset: string }> }>(
      "https://api.binance.com/api/v3/exchangeInfo",
    );

    const symbols: RawSymbol[] = (data.symbols ?? [])
      .filter((row) => row.status === "TRADING")
      .map((row) => ({
        symbol: row.symbol.toUpperCase(),
        fullSymbol: `BINANCE:${row.symbol.toUpperCase()}`,
        name: `${row.baseAsset}/${row.quoteAsset}`,
        exchange: "BINANCE",
        country: "GLOBAL",
        type: "crypto",
        currency: row.quoteAsset.toUpperCase(),
        source: "binance-full",
        metadata: { baseAsset: row.baseAsset, quoteAsset: row.quoteAsset },
      }));

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "binance-full", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_binance_full_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "binance-full", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: Coinbase products ────────────────────────────────────────────

export async function expandCoinbase(): Promise<ExpansionResult> {
  const start = Date.now();

  try {
    const products = await fetchJson<Array<{ id: string; base_currency: string; quote_currency: string; display_name?: string; status?: string }>>(
      "https://api.exchange.coinbase.com/products",
    );

    const symbols: RawSymbol[] = products
      .filter((p) => p.id && p.status !== "delisted")
      .map((p) => ({
        symbol: p.id.replace("-", "").toUpperCase(),
        fullSymbol: `COINBASE:${p.id.replace("-", "").toUpperCase()}`,
        name: p.display_name || `${p.base_currency}/${p.quote_currency}`,
        exchange: "COINBASE",
        country: "GLOBAL",
        type: "crypto",
        currency: p.quote_currency.toUpperCase(),
        source: "coinbase",
        metadata: { baseAsset: p.base_currency, quoteAsset: p.quote_currency },
      }));

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "coinbase", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_coinbase_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "coinbase", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// ── Source: Kraken asset pairs ───────────────────────────────────────────

export async function expandKraken(): Promise<ExpansionResult> {
  const start = Date.now();

  try {
    const data = await fetchJson<{ result?: Record<string, { wsname?: string; base?: string; quote?: string; status?: string }> }>(
      "https://api.kraken.com/0/public/AssetPairs",
    );

    const pairs = Object.entries(data.result ?? {});
    const symbols: RawSymbol[] = pairs
      .filter(([, v]) => v.wsname)
      .map(([key, v]) => ({
        symbol: key.toUpperCase(),
        fullSymbol: `KRAKEN:${key.toUpperCase()}`,
        name: v.wsname || key,
        exchange: "KRAKEN",
        country: "GLOBAL",
        type: "crypto",
        currency: (v.quote || "USD").toUpperCase(),
        source: "kraken",
        metadata: { base: v.base, quote: v.quote },
      }));

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "kraken", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_kraken_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "kraken", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}
// ── Source: Extended forex (exotic pairs) ───────────────────────────────

const EXOTIC_FOREX_PAIRS: Array<[string, string]> = [
  ["USDTRY", "US Dollar / Turkish Lira"], ["USDZAR", "US Dollar / South African Rand"],
  ["USDMXN", "US Dollar / Mexican Peso"], ["USDSGD", "US Dollar / Singapore Dollar"],
  ["USDHKD", "US Dollar / Hong Kong Dollar"], ["USDNOK", "US Dollar / Norwegian Krone"],
  ["USDSEK", "US Dollar / Swedish Krona"], ["USDDKK", "US Dollar / Danish Krone"],
  ["USDPLN", "US Dollar / Polish Zloty"], ["USDCZK", "US Dollar / Czech Koruna"],
  ["USDHUF", "US Dollar / Hungarian Forint"], ["USDTHB", "US Dollar / Thai Baht"],
  ["USDPHP", "US Dollar / Philippine Peso"], ["USDIDR", "US Dollar / Indonesian Rupiah"],
  ["USDMYR", "US Dollar / Malaysian Ringgit"], ["USDKRW", "US Dollar / South Korean Won"],
  ["USDTWD", "US Dollar / Taiwan Dollar"], ["USDCLP", "US Dollar / Chilean Peso"],
  ["USDCOP", "US Dollar / Colombian Peso"], ["USDBRL", "US Dollar / Brazilian Real"],
  ["USDARS", "US Dollar / Argentine Peso"], ["USDPKR", "US Dollar / Pakistani Rupee"],
  ["USDBDT", "US Dollar / Bangladeshi Taka"], ["USDLKR", "US Dollar / Sri Lankan Rupee"],
  ["USDNGN", "US Dollar / Nigerian Naira"], ["USDEGP", "US Dollar / Egyptian Pound"],
  ["USDKES", "US Dollar / Kenyan Shilling"], ["USDGHC", "US Dollar / Ghanaian Cedi"],
  ["EURJPY", "Euro / Japanese Yen"], ["EURGBP", "Euro / British Pound"],
  ["EURCHF", "Euro / Swiss Franc"], ["EURAUD", "Euro / Australian Dollar"],
  ["EURCAD", "Euro / Canadian Dollar"], ["EURNZD", "Euro / New Zealand Dollar"],
  ["GBPJPY", "British Pound / Japanese Yen"], ["GBPCHF", "British Pound / Swiss Franc"],
  ["GBPAUD", "British Pound / Australian Dollar"], ["GBPCAD", "British Pound / Canadian Dollar"],
  ["AUDJPY", "Australian Dollar / Japanese Yen"], ["AUDNZD", "Australian Dollar / New Zealand Dollar"],
  ["NZDJPY", "New Zealand Dollar / Japanese Yen"], ["CADJPY", "Canadian Dollar / Japanese Yen"],
  ["CHFJPY", "Swiss Franc / Japanese Yen"],
];

export async function expandExoticForex(): Promise<ExpansionResult> {
  const start = Date.now();
  const symbols: RawSymbol[] = EXOTIC_FOREX_PAIRS.map(([pair, name]) => ({
    symbol: pair.toUpperCase(),
    fullSymbol: `FX:${pair.toUpperCase()}`,
    name,
    exchange: "FOREX",
    country: "GLOBAL",
    type: "forex",
    currency: pair.slice(0, 3).toUpperCase(),
    source: "curated-exotic-forex",
  }));

  const { inserted, skipped } = await upsertToGlobalMaster(symbols);
  return { source: "exotic-forex", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
}

// ── Source: Global Indices ───────────────────────────────────────────────

const GLOBAL_INDICES: Array<{ symbol: string; name: string; exchange: string; country: string }> = [
  { symbol: "NIFTY50", name: "Nifty 50", exchange: "NSE", country: "IN" },
  { symbol: "SENSEX", name: "BSE Sensex", exchange: "BSE", country: "IN" },
  { symbol: "NIFTYBANK", name: "Nifty Bank", exchange: "NSE", country: "IN" },
  { symbol: "NIFTYIT", name: "Nifty IT", exchange: "NSE", country: "IN" },
  { symbol: "SPX", name: "S&P 500", exchange: "SP", country: "US" },
  { symbol: "NDX", name: "NASDAQ 100", exchange: "NASDAQ", country: "US" },
  { symbol: "DJI", name: "Dow Jones Industrial Average", exchange: "DJ", country: "US" },
  { symbol: "RUT", name: "Russell 2000", exchange: "RUSSELL", country: "US" },
  { symbol: "VIX", name: "CBOE Volatility Index", exchange: "CBOE", country: "US" },
  { symbol: "FTSE", name: "FTSE 100", exchange: "LSE", country: "GB" },
  { symbol: "FTSE250", name: "FTSE 250", exchange: "LSE", country: "GB" },
  { symbol: "DAX", name: "DAX 40", exchange: "XETRA", country: "DE" },
  { symbol: "CAC40", name: "CAC 40", exchange: "EURONEXT", country: "FR" },
  { symbol: "IBEX35", name: "IBEX 35", exchange: "BME", country: "ES" },
  { symbol: "FTSEMIB", name: "FTSE MIB", exchange: "MIL", country: "IT" },
  { symbol: "AEX", name: "AEX", exchange: "EURONEXT", country: "NL" },
  { symbol: "SMI", name: "Swiss Market Index", exchange: "SIX", country: "CH" },
  { symbol: "NIKKEI225", name: "Nikkei 225", exchange: "TSE", country: "JP" },
  { symbol: "TOPIX", name: "TOPIX", exchange: "TSE", country: "JP" },
  { symbol: "HANGSENG", name: "Hang Seng", exchange: "HKEX", country: "HK" },
  { symbol: "SSE", name: "Shanghai Composite", exchange: "SSE", country: "CN" },
  { symbol: "SZSE", name: "Shenzhen Component", exchange: "SZSE", country: "CN" },
  { symbol: "CSI300", name: "CSI 300", exchange: "SSE", country: "CN" },
  { symbol: "KOSPI", name: "KOSPI", exchange: "KRX", country: "KR" },
  { symbol: "TAIEX", name: "Taiwan Weighted", exchange: "TWSE", country: "TW" },
  { symbol: "STI", name: "Straits Times Index", exchange: "SGX", country: "SG" },
  { symbol: "KLCI", name: "FTSE Bursa Malaysia KLCI", exchange: "BURSA", country: "MY" },
  { symbol: "SET", name: "SET Index", exchange: "SET", country: "TH" },
  { symbol: "JKSE", name: "Jakarta Composite", exchange: "IDX", country: "ID" },
  { symbol: "ASX200", name: "S&P/ASX 200", exchange: "ASX", country: "AU" },
  { symbol: "NZX50", name: "NZX 50", exchange: "NZX", country: "NZ" },
  { symbol: "TSX", name: "S&P/TSX Composite", exchange: "TSX", country: "CA" },
  { symbol: "BOVESPA", name: "Bovespa", exchange: "BVMF", country: "BR" },
  { symbol: "MERVAL", name: "MERVAL", exchange: "BCBA", country: "AR" },
  { symbol: "TADAWUL", name: "Tadawul All Share", exchange: "SAU", country: "SA" },
  { symbol: "EGX30", name: "EGX 30", exchange: "EGX", country: "EG" },
  { symbol: "TOP40", name: "JSE Top 40", exchange: "JSE", country: "ZA" },
  { symbol: "MOEX", name: "MOEX Russia", exchange: "MOEX", country: "RU" },
  { symbol: "BIST100", name: "BIST 100", exchange: "BIST", country: "TR" },
];

export async function expandGlobalIndices(): Promise<ExpansionResult> {
  const start = Date.now();
  const symbols: RawSymbol[] = GLOBAL_INDICES.map((idx) => ({
    symbol: idx.symbol.toUpperCase(),
    fullSymbol: `${idx.exchange}:${idx.symbol.toUpperCase()}`,
    name: idx.name,
    exchange: idx.exchange,
    country: idx.country,
    type: "index",
    currency: deriveCurrency(idx.country),
    source: "curated-global-indices",
  }));

  const { inserted, skipped } = await upsertToGlobalMaster(symbols);
  return { source: "global-indices", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
}