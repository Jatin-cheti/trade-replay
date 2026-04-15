import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";
import { inferDomainForSymbol } from "./domainInference.service";
import { computePrefixesForSymbol } from "./searchIntelligence.service";
import { markSearchIndexDirty } from "./searchIndex.service";
import { produceAssetCreated } from "../kafka/eventProducers";

export interface NormalizedSymbol {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: "stock" | "crypto" | "forex" | "index" | "etf" | "bond" | "derivative" | "economy";
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

/* ── ETF ingestion (via NASDAQ/NYSE listing data - filter by ETF flag) ── */
async function ingestEtfs(): Promise<NormalizedSymbol[]> {
  const etfs: Array<[string, string, string, string]> = [
    // US Major ETFs
    ["SPY", "SPDR S&P 500 ETF Trust", "NYSE", "US"],
    ["QQQ", "Invesco QQQ Trust", "NASDAQ", "US"],
    ["IWM", "iShares Russell 2000 ETF", "NYSE", "US"],
    ["VTI", "Vanguard Total Stock Market ETF", "NYSE", "US"],
    ["VOO", "Vanguard S&P 500 ETF", "NYSE", "US"],
    ["VEA", "Vanguard FTSE Developed Markets ETF", "NYSE", "US"],
    ["VWO", "Vanguard FTSE Emerging Markets ETF", "NYSE", "US"],
    ["EFA", "iShares MSCI EAFE ETF", "NYSE", "US"],
    ["EEM", "iShares MSCI Emerging Markets ETF", "NYSE", "US"],
    ["GLD", "SPDR Gold Shares", "NYSE", "US"],
    ["SLV", "iShares Silver Trust", "NYSE", "US"],
    ["TLT", "iShares 20+ Year Treasury Bond ETF", "NASDAQ", "US"],
    ["AGG", "iShares Core U.S. Aggregate Bond ETF", "NYSE", "US"],
    ["LQD", "iShares iBoxx Investment Grade Corporate Bond ETF", "NYSE", "US"],
    ["HYG", "iShares iBoxx High Yield Corporate Bond ETF", "NYSE", "US"],
    ["XLF", "Financial Select Sector SPDR Fund", "NYSE", "US"],
    ["XLK", "Technology Select Sector SPDR Fund", "NYSE", "US"],
    ["XLE", "Energy Select Sector SPDR Fund", "NYSE", "US"],
    ["XLV", "Health Care Select Sector SPDR Fund", "NYSE", "US"],
    ["XLI", "Industrial Select Sector SPDR Fund", "NYSE", "US"],
    ["XLP", "Consumer Staples Select Sector SPDR Fund", "NYSE", "US"],
    ["XLY", "Consumer Discretionary Select Sector SPDR Fund", "NYSE", "US"],
    ["XLU", "Utilities Select Sector SPDR Fund", "NYSE", "US"],
    ["ARKK", "ARK Innovation ETF", "NYSE", "US"],
    ["ARKW", "ARK Next Generation Internet ETF", "NYSE", "US"],
    ["DIA", "SPDR Dow Jones Industrial Average ETF", "NYSE", "US"],
    ["VNQ", "Vanguard Real Estate Index Fund", "NYSE", "US"],
    ["SCHD", "Schwab U.S. Dividend Equity ETF", "NYSE", "US"],
    ["BND", "Vanguard Total Bond Market ETF", "NASDAQ", "US"],
    ["IEMG", "iShares Core MSCI Emerging Markets ETF", "NYSE", "US"],
    // India ETFs
    ["NIFTYBEES", "Nippon India ETF Nifty BeES", "NSE", "IN"],
    ["BANKBEES", "Nippon India ETF Bank BeES", "NSE", "IN"],
    ["GOLDBEES", "Nippon India ETF Gold BeES", "NSE", "IN"],
    ["JUNIORBEES", "Nippon India ETF Junior BeES", "NSE", "IN"],
    // UK ETFs
    ["ISF", "iShares Core FTSE 100 UCITS ETF", "LSE", "GB"],
    ["VWRL", "Vanguard FTSE All-World UCITS ETF", "LSE", "GB"],
    // Japan ETFs
    ["1321", "Nikkei 225 Exchange Traded Fund", "TSE", "JP"],
    ["1306", "TOPIX Exchange Traded Fund", "TSE", "JP"],
  ];

  return etfs.map(([symbol, name, exchange, country]) => ({
    symbol,
    fullSymbol: `${exchange}:${symbol}`,
    name,
    exchange,
    country,
    type: "etf" as const,
    currency: country === "IN" ? "INR" : country === "GB" ? "GBP" : country === "JP" ? "JPY" : "USD",
    popularity: 0,
    source: "curated-etf",
  }));
}

/* ── Bond ingestion (government + corporate benchmarks) ── */
async function ingestBonds(): Promise<NormalizedSymbol[]> {
  const bonds: Array<[string, string, string, string]> = [
    // US Treasuries
    ["US10Y", "US 10-Year Treasury Yield", "GOVT", "US"],
    ["US2Y", "US 2-Year Treasury Yield", "GOVT", "US"],
    ["US5Y", "US 5-Year Treasury Yield", "GOVT", "US"],
    ["US30Y", "US 30-Year Treasury Yield", "GOVT", "US"],
    ["US3M", "US 3-Month Treasury Bill", "GOVT", "US"],
    // Corporate Bonds
    ["USIG", "US Investment Grade Corporate Bonds", "CORP", "US"],
    ["USHY", "US High Yield Corporate Bonds", "CORP", "US"],
    // International
    ["GB10Y", "UK 10-Year Gilt Yield", "GOVT", "GB"],
    ["DE10Y", "Germany 10-Year Bund Yield", "GOVT", "DE"],
    ["JP10Y", "Japan 10-Year Government Bond Yield", "GOVT", "JP"],
    ["IN10Y", "India 10-Year Government Bond Yield", "GOVT", "IN"],
    ["FR10Y", "France 10-Year OAT Yield", "GOVT", "FR"],
    ["AU10Y", "Australia 10-Year Government Bond", "GOVT", "AU"],
    ["CA10Y", "Canada 10-Year Government Bond", "GOVT", "CA"],
    ["CN10Y", "China 10-Year Government Bond", "GOVT", "CN"],
  ];

  return bonds.map(([symbol, name, exchange, country]) => ({
    symbol,
    fullSymbol: `${exchange}:${symbol}`,
    name,
    exchange,
    country,
    type: "bond" as const,
    currency: country === "IN" ? "INR" : country === "GB" ? "GBP" : country === "JP" ? "JPY" : "USD",
    popularity: 0,
    source: "curated-bond",
  }));
}

/* ── Futures ingestion (commodities + financial futures) ── */
async function ingestFutures(): Promise<NormalizedSymbol[]> {
  const futures: Array<[string, string, string, string]> = [
    // Commodities
    ["CL", "Crude Oil Futures (WTI)", "NYMEX", "US"],
    ["BZ", "Brent Crude Oil Futures", "ICE", "GB"],
    ["GC", "Gold Futures", "COMEX", "US"],
    ["SI", "Silver Futures", "COMEX", "US"],
    ["HG", "Copper Futures", "COMEX", "US"],
    ["NG", "Natural Gas Futures", "NYMEX", "US"],
    ["ZC", "Corn Futures", "CBOT", "US"],
    ["ZW", "Wheat Futures", "CBOT", "US"],
    ["ZS", "Soybean Futures", "CBOT", "US"],
    ["CT", "Cotton Futures", "ICE", "US"],
    ["KC", "Coffee Futures", "ICE", "US"],
    ["SB", "Sugar Futures", "ICE", "US"],
    ["CC", "Cocoa Futures", "ICE", "US"],
    ["PL", "Platinum Futures", "NYMEX", "US"],
    ["PA", "Palladium Futures", "NYMEX", "US"],
    // Financial Futures
    ["ES", "E-mini S&P 500 Futures", "CME", "US"],
    ["NQ", "E-mini NASDAQ 100 Futures", "CME", "US"],
    ["YM", "E-mini Dow Jones Futures", "CBOT", "US"],
    ["RTY", "E-mini Russell 2000 Futures", "CME", "US"],
    ["ZN", "10-Year T-Note Futures", "CBOT", "US"],
    ["ZB", "30-Year T-Bond Futures", "CBOT", "US"],
    ["6E", "Euro FX Futures", "CME", "US"],
    ["6J", "Japanese Yen Futures", "CME", "US"],
    ["6B", "British Pound Futures", "CME", "US"],
    // Crypto futures
    ["BTCUSDT-PERP", "Bitcoin USDT Perpetual", "BINANCE", "GLOBAL"],
    ["ETHUSDT-PERP", "Ethereum USDT Perpetual", "BINANCE", "GLOBAL"],
    // India Futures
    ["CRUDEOIL", "Crude Oil Futures", "MCX", "IN"],
    ["GOLD", "Gold Futures", "MCX", "IN"],
    ["SILVER", "Silver Futures", "MCX", "IN"],
    ["NATURALGAS", "Natural Gas Futures", "MCX", "IN"],
    ["NIFTY-FUT", "Nifty 50 Futures", "NSE", "IN"],
    ["BANKNIFTY-FUT", "Bank Nifty Futures", "NSE", "IN"],
  ];

  return futures.map(([symbol, name, exchange, country]) => ({
    symbol,
    fullSymbol: `${exchange}:${symbol}`,
    name,
    exchange,
    country,
    type: "derivative" as const,
    currency: country === "IN" ? "INR" : "USD",
    popularity: 0,
    source: "curated-futures",
  }));
}

/* ── Economy indicators (macro data) ── */
async function ingestEconomy(): Promise<NormalizedSymbol[]> {
  const indicators: Array<[string, string, string, string]> = [
    // US
    ["GDP-US", "US Gross Domestic Product", "FRED", "US"],
    ["CPI-US", "US Consumer Price Index", "FRED", "US"],
    ["UNRATE-US", "US Unemployment Rate", "FRED", "US"],
    ["FEDFUNDS", "Federal Funds Rate", "FRED", "US"],
    ["DXY", "US Dollar Index", "ICE", "US"],
    ["VIX", "CBOE Volatility Index", "CBOE", "US"],
    ["MOVE", "ICE BofA MOVE Index", "ICE", "US"],
    // India
    ["GDP-IN", "India Gross Domestic Product", "RBI", "IN"],
    ["CPI-IN", "India Consumer Price Index", "RBI", "IN"],
    ["REPO-IN", "India Repo Rate", "RBI", "IN"],
    // Global
    ["GDP-GB", "UK Gross Domestic Product", "ONS", "GB"],
    ["GDP-JP", "Japan Gross Domestic Product", "BOJ", "JP"],
    ["GDP-DE", "Germany Gross Domestic Product", "DESTATIS", "DE"],
    ["GDP-CN", "China Gross Domestic Product", "NBS", "CN"],
    ["BRENT", "Brent Crude Oil Price", "ICE", "GB"],
    ["GOLD-SPOT", "Gold Spot Price", "LBMA", "GB"],
    ["USDX", "US Dollar Index", "ICE", "US"],
  ];

  return indicators.map(([symbol, name, exchange, country]) => ({
    symbol,
    fullSymbol: `${exchange}:${symbol}`,
    name,
    exchange,
    country,
    type: "economy" as const,
    currency: country === "IN" ? "INR" : country === "GB" ? "GBP" : country === "JP" ? "JPY" : "USD",
    popularity: 0,
    source: "curated-economy",
  }));
}

/* ── UK Stocks (curated top listings) ── */
async function ingestUkStocks(): Promise<NormalizedSymbol[]> {
  const stocks: Array<[string, string]> = [
    ["SHEL", "Shell"], ["AZN", "AstraZeneca"], ["HSBA", "HSBC Holdings"],
    ["ULVR", "Unilever"], ["BP", "BP"], ["GSK", "GSK"],
    ["RIO", "Rio Tinto"], ["BATS", "British American Tobacco"],
    ["DGE", "Diageo"], ["LSEG", "London Stock Exchange Group"],
    ["REL", "RELX"], ["AAL", "Anglo American"], ["PRU", "Prudential"],
    ["CRH", "CRH"], ["NG", "National Grid"], ["VOD", "Vodafone"],
    ["LLOY", "Lloyds Banking Group"], ["BARC", "Barclays"],
    ["GLEN", "Glencore"], ["STAN", "Standard Chartered"],
    ["ABF", "Associated British Foods"], ["RR", "Rolls-Royce Holdings"],
    ["SSE", "SSE"], ["SVT", "Severn Trent"], ["IMB", "Imperial Brands"],
  ];

  return stocks.map(([symbol, name]) => ({
    symbol,
    fullSymbol: `LSE:${symbol}`,
    name,
    exchange: "LSE",
    country: "GB",
    type: "stock" as const,
    currency: "GBP",
    companyDomain: inferDomainForSymbol({ symbol, name, exchange: "LSE" }) ?? undefined,
    popularity: 0,
    source: "curated-lse",
  }));
}

/* ── Japan Stocks (curated Nikkei 225 components) ── */
async function ingestJapanStocks(): Promise<NormalizedSymbol[]> {
  const stocks: Array<[string, string]> = [
    ["7203", "Toyota Motor Corp"], ["6758", "Sony Group Corp"],
    ["9984", "SoftBank Group Corp"], ["6861", "Keyence Corp"],
    ["6902", "DENSO Corp"], ["8306", "Mitsubishi UFJ Financial"],
    ["7267", "Honda Motor Co"], ["9432", "Nippon Telegraph & Telephone"],
    ["6501", "Hitachi"], ["7741", "HOYA Corp"],
    ["8035", "Tokyo Electron"], ["4502", "Takeda Pharmaceutical"],
    ["4063", "Shin-Etsu Chemical"], ["6098", "Recruit Holdings"],
    ["7974", "Nintendo Co"], ["8058", "Mitsubishi Corp"],
    ["8316", "Sumitomo Mitsui Financial"], ["6367", "Daikin Industries"],
    ["3382", "Seven & i Holdings"], ["4568", "Daiichi Sankyo"],
  ];

  return stocks.map(([symbol, name]) => ({
    symbol,
    fullSymbol: `TSE:${symbol}`,
    name,
    exchange: "TSE",
    country: "JP",
    type: "stock" as const,
    currency: "JPY",
    popularity: 0,
    source: "curated-tse",
  }));
}

/* ── Additional Forex pairs ── */
async function ingestForexExtended(): Promise<NormalizedSymbol[]> {
  const pairs: Array<[string, string]> = [
    ["USDCNY", "US Dollar / Chinese Yuan"],
    ["USDHKD", "US Dollar / Hong Kong Dollar"],
    ["USDSGD", "US Dollar / Singapore Dollar"],
    ["USDKRW", "US Dollar / South Korean Won"],
    ["USDTRY", "US Dollar / Turkish Lira"],
    ["USDMXN", "US Dollar / Mexican Peso"],
    ["USDZAR", "US Dollar / South African Rand"],
    ["USDBRL", "US Dollar / Brazilian Real"],
    ["EURAUD", "Euro / Australian Dollar"],
    ["EURNZD", "Euro / New Zealand Dollar"],
    ["EURCHF", "Euro / Swiss Franc"],
    ["GBPJPY", "British Pound / Japanese Yen"],
    ["AUDJPY", "Australian Dollar / Japanese Yen"],
    ["CADJPY", "Canadian Dollar / Japanese Yen"],
    ["CHFJPY", "Swiss Franc / Japanese Yen"],
    ["XAUUSD", "Gold / US Dollar"],
    ["XAGUSD", "Silver / US Dollar"],
  ];

  return pairs.map(([symbol, name]) => ({
    symbol,
    fullSymbol: `FX:${symbol}`,
    name,
    exchange: "FOREX",
    country: "GLOBAL",
    type: "forex" as const,
    currency: symbol.slice(0, 3),
    popularity: 0,
    source: "curated-forex",
  }));
}

export async function ingestGlobalSymbols(): Promise<{ upserted: number; totalSourceRows: number }> {
  const [us, india, crypto, forex, indices, etfs, bonds, futures, economy, uk, japan, forexExt] = await Promise.all([
    ingestUsStocks(),
    ingestIndiaStocks(),
    ingestCrypto(),
    ingestForex(),
    ingestIndices(),
    ingestEtfs(),
    ingestBonds(),
    ingestFutures(),
    ingestEconomy(),
    ingestUkStocks(),
    ingestJapanStocks(),
    ingestForexExtended(),
  ]);

  const all = [...us, ...india, ...crypto, ...forex, ...indices, ...etfs, ...bonds, ...futures, ...economy, ...uk, ...japan, ...forexExt];
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

    // Emit Kafka events for newly ingested assets (fire-and-forget)
    for (const item of deduped.values()) {
      produceAssetCreated({
        fullSymbol: item.fullSymbol,
        symbol: item.symbol,
        name: item.name,
        exchange: item.exchange,
        type: item.type,
        source: item.source,
      });
    }
  }

  return {
    upserted: operations.length,
    totalSourceRows: all.length,
  };
}
