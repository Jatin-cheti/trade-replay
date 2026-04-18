import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";
import { inferDomainForSymbol } from "./domainInference.service";
import { computePrefixesForSymbol } from "./searchIntelligence.service";
import { markSearchIndexDirty } from "./searchIndex.service";

export interface NormalizedSymbol {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: "stock" | "crypto" | "forex" | "index";
  currency: string;
  iconUrl?: string;
  companyDomain?: string;
  popularity: number;
  source: string;
}

const CRYPTO_ICON_ID_MAP: Record<string, string> = {
  "1INCH": "1inch",
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  USDC: "usd-coin",
  ADA: "cardano",
  DOGE: "dogecoin",
  TON: "the-open-network",
  TRX: "tron",
  DOT: "polkadot",
  MATIC: "matic-network",
  SHIB: "shiba-inu",
  LTC: "litecoin",
};

function coinGeckoIconUrl(id: string): string {
  return `https://assets.coingecko.com/coins/images/${id}/small.png`;
}

function normalizeSymbol(input: NormalizedSymbol): NormalizedSymbol {
  return {
    ...input,
    symbol: input.symbol.trim().toUpperCase(),
    fullSymbol: input.fullSymbol.trim().toUpperCase(),
    name: input.name.trim(),
    exchange: input.exchange.trim().toUpperCase(),
    country: input.country.trim().toUpperCase(),
    currency: input.currency.trim().toUpperCase(),
    iconUrl: input.iconUrl?.trim(),
    companyDomain: input.companyDomain?.trim().toLowerCase(),
  };
}

function parsePipeSeparated(content: string): Array<Record<string, string>> {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split("|").map((header) => header.trim());
  return lines.slice(1)
    .filter((line) => !line.startsWith("File Creation Time"))
    .map((line) => {
      const values = line.split("|");
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = (values[index] ?? "").trim();
      });
      return row;
    });
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": "tradereplay-symbol-ingestion/1.0" } });
  if (!response.ok) {
    throw new Error(`FETCH_FAILED_${response.status}_${url}`);
  }
  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": "tradereplay-symbol-ingestion/1.0" } });
  if (!response.ok) {
    throw new Error(`FETCH_FAILED_${response.status}_${url}`);
  }
  return response.json() as Promise<T>;
}

async function ingestUsStocks(): Promise<NormalizedSymbol[]> {
  try {
    const [nasdaqText, nyseText] = await Promise.all([
      fetchText("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"),
      fetchText("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"),
    ]);

    const nasdaqRows = parsePipeSeparated(nasdaqText)
      .filter((row) => row.Symbol && row["Test Issue"] !== "Y")
      .map((row) => normalizeSymbol({
        symbol: row.Symbol,
        fullSymbol: `NASDAQ:${row.Symbol}`,
        name: row["Security Name"] || row.Symbol,
        exchange: "NASDAQ",
        country: "US",
        type: "stock",
        currency: "USD",
        popularity: 0,
        source: "nasdaq-trader",
      }));

    const otherRows = parsePipeSeparated(nyseText)
      .filter((row) => row["ACT Symbol"] && row["Test Issue"] !== "Y")
      .map((row) => {
        const symbol = row["ACT Symbol"];
        const listingExchange = row["Exchange"] === "N" ? "NYSE" : row["Exchange"] === "A" ? "NYSEARCA" : "NYSE";
        const name = row["Security Name"] || symbol;
        return normalizeSymbol({
          symbol,
          fullSymbol: `${listingExchange}:${symbol}`,
          name,
          exchange: listingExchange,
          country: "US",
          type: "stock",
          currency: "USD",
          companyDomain: inferDomainForSymbol({ symbol, name, exchange: listingExchange }) ?? undefined,
          popularity: 0,
          source: "nasdaq-trader",
        });
      });

    return [...nasdaqRows, ...otherRows];
  } catch (error) {
    logger.warn("symbol_ingest_us_fallback", { message: error instanceof Error ? error.message : String(error) });
    const fallback = ["AAPL", "MSFT", "AMZN", "GOOGL", "NVDA", "META", "TSLA", "JPM", "V", "WMT"];
    return fallback.map((symbol) => normalizeSymbol({
      symbol,
      fullSymbol: `NASDAQ:${symbol}`,
      name: symbol,
      exchange: "NASDAQ",
      country: "US",
      type: "stock",
      currency: "USD",
      popularity: 0,
      source: "fallback",
    }));
  }
}

async function ingestIndiaStocks(): Promise<NormalizedSymbol[]> {
  try {
    const nseCsv = await fetchText("https://archives.nseindia.com/content/equities/EQUITY_L.csv");
    const lines = nseCsv.split(/\r?\n/).slice(1).filter((line) => line.trim().length > 0);
    const parsed = lines.map((line) => line.split(",").map((part) => part.replace(/^"|"$/g, "").trim()));

    const mapped = parsed
      .filter((columns) => columns[0])
      .map((columns) => {
        const symbol = columns[0];
        const name = columns[1] || symbol;
        return normalizeSymbol({
          symbol,
          fullSymbol: `NSE:${symbol}`,
          name,
          exchange: "NSE",
          country: "IN",
          type: "stock",
          currency: "INR",
          companyDomain: inferDomainForSymbol({ symbol, name, exchange: "NSE" }) ?? undefined,
          popularity: 0,
          source: "nse-equity-list",
        });
      });

    const bseFallback = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "ITC", "LT", "SBIN"]
      .map((symbol) => normalizeSymbol({
        symbol,
        fullSymbol: `BSE:${symbol}`,
        name: symbol,
        exchange: "BSE",
        country: "IN",
        type: "stock",
        currency: "INR",
        companyDomain: inferDomainForSymbol({ symbol, name: symbol, exchange: "BSE" }) ?? undefined,
        popularity: 0,
        source: "bse-curated",
      }));

    return [...mapped, ...bseFallback];
  } catch (error) {
    logger.warn("symbol_ingest_india_fallback", { message: error instanceof Error ? error.message : String(error) });
    return ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "ITC", "LT", "SBIN", "DMART", "TITAN"].flatMap((symbol) => [
      normalizeSymbol({
        symbol,
        fullSymbol: `NSE:${symbol}`,
        name: symbol,
        exchange: "NSE",
        country: "IN",
        type: "stock",
        currency: "INR",
        popularity: 0,
        source: "fallback",
      }),
      normalizeSymbol({
        symbol,
        fullSymbol: `BSE:${symbol}`,
        name: symbol,
        exchange: "BSE",
        country: "IN",
        type: "stock",
        currency: "INR",
        popularity: 0,
        source: "fallback",
      }),
    ]);
  }
}

async function ingestCrypto(): Promise<NormalizedSymbol[]> {
  const records: NormalizedSymbol[] = [];
  const coinIconsBySymbol = new Map<string, string>();

  try {
    const coinGecko = await fetchJson<Array<{ id: string; symbol: string; name: string; image?: string; market_cap_rank?: number }>>(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false",
    );

    coinGecko.forEach((coin) => {
      if (coin.symbol && coin.image) {
        coinIconsBySymbol.set(coin.symbol.toUpperCase(), coin.image);
      }
    });

    records.push(...coinGecko
      .filter((coin) => coin.symbol)
      .map((coin) => {
        const upperSymbol = coin.symbol.toUpperCase();
        const fallbackId = CRYPTO_ICON_ID_MAP[upperSymbol];
        return normalizeSymbol({
        symbol: upperSymbol,
        fullSymbol: `CRYPTO:${upperSymbol}`,
        name: coin.name,
        exchange: "GLOBAL",
        country: "GLOBAL",
        type: "crypto",
        currency: "USD",
        iconUrl: coin.image || (fallbackId ? coinGeckoIconUrl(fallbackId) : undefined),
        popularity: 0,
        source: "coingecko",
      });
      }));
  } catch (error) {
    logger.warn("symbol_ingest_coingecko_fallback", { message: error instanceof Error ? error.message : String(error) });
  }

  try {
    const binance = await fetchJson<{ symbols?: Array<{ symbol: string; status: string; baseAsset: string; quoteAsset: string }> }>(
      "https://api.binance.com/api/v3/exchangeInfo",
    );

    records.push(...(binance.symbols ?? [])
      .filter((row) => row.status === "TRADING" && ["USDT", "USD", "BTC", "ETH"].includes(row.quoteAsset))
      .slice(0, 700)
      .map((row) => {
        const baseSymbol = row.baseAsset.toUpperCase();
        const mappedId = CRYPTO_ICON_ID_MAP[baseSymbol];
        return normalizeSymbol({
        symbol: row.symbol,
        fullSymbol: `BINANCE:${row.symbol}`,
        name: `${row.baseAsset}/${row.quoteAsset}`,
        exchange: "BINANCE",
        country: "GLOBAL",
        type: "crypto",
        currency: row.quoteAsset,
        iconUrl: coinIconsBySymbol.get(baseSymbol)
          || (mappedId ? coinGeckoIconUrl(mappedId) : undefined)
          || `https://cryptoicons.org/api/icon/${baseSymbol.toLowerCase()}/200`,
        popularity: 0,
        source: "binance",
      });
      }));
  } catch (error) {
    logger.warn("symbol_ingest_binance_fallback", { message: error instanceof Error ? error.message : String(error) });
  }

  if (records.length === 0) {
    return ["BTCUSD", "ETHUSD", "BNBUSD", "SOLUSD", "XRPUSD"].map((symbol) => normalizeSymbol({
      symbol,
      fullSymbol: `CRYPTO:${symbol}`,
      name: symbol,
      exchange: "GLOBAL",
      country: "GLOBAL",
      type: "crypto",
      currency: "USD",
      iconUrl: coinGeckoIconUrl(CRYPTO_ICON_ID_MAP[symbol.replace("USD", "")] ?? "bitcoin"),
      popularity: 0,
      source: "fallback",
    }));
  }

  return records;
}

async function ingestForex(): Promise<NormalizedSymbol[]> {
  const pairs = [
    ["EURUSD", "Euro / US Dollar"],
    ["GBPUSD", "British Pound / US Dollar"],
    ["USDJPY", "US Dollar / Japanese Yen"],
    ["USDCHF", "US Dollar / Swiss Franc"],
    ["AUDUSD", "Australian Dollar / US Dollar"],
    ["USDCAD", "US Dollar / Canadian Dollar"],
    ["NZDUSD", "New Zealand Dollar / US Dollar"],
    ["EURGBP", "Euro / British Pound"],
    ["EURJPY", "Euro / Japanese Yen"],
    ["USDINR", "US Dollar / Indian Rupee"],
    ["EURINR", "Euro / Indian Rupee"],
    ["GBPINR", "British Pound / Indian Rupee"],
  ] as const;

  return pairs.map(([symbol, name]) => normalizeSymbol({
    symbol,
    fullSymbol: `FX:${symbol}`,
    name,
    exchange: "FOREX",
    country: "GLOBAL",
    type: "forex",
    currency: symbol.slice(0, 3),
    popularity: 0,
    source: "curated",
  }));
}

async function ingestIndices(): Promise<NormalizedSymbol[]> {
  const indices = [
    ["NIFTY50", "Nifty 50", "NSE", "IN"],
    ["SENSEX", "BSE Sensex", "BSE", "IN"],
    ["SPX", "S&P 500", "SP", "US"],
    ["NDX", "NASDAQ 100", "NASDAQ", "US"],
    ["DJI", "Dow Jones Industrial Average", "DJ", "US"],
    ["RUT", "Russell 2000", "RUSSELL", "US"],
    ["FTSE", "FTSE 100", "LSE", "GB"],
    ["DAX", "DAX 40", "XETRA", "DE"],
    ["CAC40", "CAC 40", "EURONEXT", "FR"],
    ["NIKKEI225", "Nikkei 225", "TSE", "JP"],
    ["HANGSENG", "Hang Seng", "HKEX", "HK"],
  ] as const;

  return indices.map(([symbol, name, exchange, country]) => normalizeSymbol({
    symbol,
    fullSymbol: `${exchange}:${symbol}`,
    name,
    exchange,
    country,
    type: "index",
    currency: country === "IN" ? "INR" : "USD",
    popularity: 0,
    source: "curated",
  }));
}

export async function ingestGlobalSymbols(): Promise<{ upserted: number; totalSourceRows: number }> {
  const [us, india, crypto, forex, indices] = await Promise.all([
    ingestUsStocks(),
    ingestIndiaStocks(),
    ingestCrypto(),
    ingestForex(),
    ingestIndices(),
  ]);

  const all = [...us, ...india, ...crypto, ...forex, ...indices];
  const deduped = new Map<string, NormalizedSymbol>();

  for (const item of all) {
    deduped.set(item.fullSymbol, item);
  }

  const operations = Array.from(deduped.values()).map((item) => ({
    updateOne: {
      filter: { fullSymbol: item.fullSymbol },
      update: {
        $set: {
          symbol: item.symbol,
          fullSymbol: item.fullSymbol,
          name: item.name,
          exchange: item.exchange,
          country: item.country,
          type: item.type,
          currency: item.currency,
          iconUrl: item.iconUrl ?? "",
          companyDomain: item.companyDomain ?? "",
          logoValidatedAt: null,
          s3Icon: "",
          popularity: item.popularity,
          source: item.source,
          ...computePrefixesForSymbol(item.symbol, item.name),
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await SymbolModel.bulkWrite(operations, { ordered: false });
    markSearchIndexDirty("ingest_global_symbols");
  }

  return {
    upserted: operations.length,
    totalSourceRows: all.length,
  };
}
