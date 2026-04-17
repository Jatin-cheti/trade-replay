/**
 * ingestion/sources.ts — Individual source fetchers.
 *
 * Each function returns an array of raw symbol rows ready for upsert.
 * No DB access here — pure fetch + transform.
 */
import { env } from "../config/env";
import { logger } from "../utils/logger";

const UA = "tradereplay-ingestion/4.0";
const FETCH_TIMEOUT = 30_000;

interface RawSymbol {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency: string;
  source: string;
  iconUrl?: string;
  domain?: string;
  priorityScore?: number;
  marketCap?: number;
  volume?: number;
}

async function fetchJson(url: string, timeout = FETCH_TIMEOUT): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
    if (r.status === 429) throw new Error(`429 rate limited: ${url.split("?")[0]}`);
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url.split("?")[0]}`);
    return r.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string, timeout = FETCH_TIMEOUT): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
    if (r.status === 429) throw new Error(`429 rate limited: ${url.split("?")[0]}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  } finally {
    clearTimeout(t);
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  US Stocks                                                          */
/* ──────────────────────────────────────────────────────────────────── */

export async function fetchNasdaqTrader(): Promise<RawSymbol[]> {
  const [nasdaqText, otherText] = await Promise.all([
    fetchText("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"),
    fetchText("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"),
  ]);
  const rows: RawSymbol[] = [];
  for (const line of nasdaqText.split("\n").slice(1)) {
    const parts = line.split("|");
    if (parts.length < 2 || parts[0] === "File Creation Time") continue;
    const sym = parts[0].trim();
    const name = parts[1]?.trim() || sym;
    if (!sym || sym.length > 10 || /[^A-Z0-9.$-]/.test(sym)) continue;
    rows.push({ symbol: sym, fullSymbol: `NASDAQ:${sym}`, name, exchange: "NASDAQ", country: "US", type: "stock", currency: "USD", source: "nasdaq-trader" });
  }
  for (const line of otherText.split("\n").slice(1)) {
    const parts = line.split("|");
    if (parts.length < 3 || parts[0] === "File Creation Time") continue;
    const sym = parts[7]?.trim() || parts[0].trim();
    const name = parts[1]?.trim() || sym;
    const exch = parts[2]?.trim() === "N" ? "NYSE" : parts[2]?.trim() === "A" ? "AMEX" : "NYSE";
    if (!sym || sym.length > 10) continue;
    rows.push({ symbol: sym, fullSymbol: `${exch}:${sym}`, name, exchange: exch, country: "US", type: "stock", currency: "USD", source: "nasdaq-trader" });
  }
  return rows;
}

export async function fetchAlphaVantage(): Promise<RawSymbol[]> {
  const key = env.ALPHA_VANTAGE_KEY;
  if (!key) throw new Error("ALPHA_VANTAGE_KEY is required for Alpha Vantage ingestion");
  const csv = await fetchText(`https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${key}`, 60_000);
  const rows: RawSymbol[] = [];
  for (const line of csv.split("\n").slice(1)) {
    const [sym, name, exch, assetType, , , status] = line.split(",");
    if (!sym || !name || status?.trim() === "Delisted") continue;
    const exchange = exch?.includes("NASDAQ") ? "NASDAQ" : exch?.includes("NYSE") ? "NYSE" : exch || "NYSE";
    const type = assetType === "ETF" ? "etf" : "stock";
    rows.push({ symbol: sym.trim(), fullSymbol: `${exchange}:${sym.trim()}`, name: name.trim(), exchange, country: "US", type, currency: "USD", source: "alpha-vantage" });
  }
  return rows;
}

export async function fetchSEC(): Promise<RawSymbol[]> {
  const data = await fetchJson("https://www.sec.gov/files/company_tickers.json");
  return Object.values(data as Record<string, { ticker: string; title: string }>)
    .map((c) => {
      const sym = (c.ticker || "").toUpperCase().trim();
      return { symbol: sym, fullSymbol: `NYSE:${sym}`, name: c.title || sym, exchange: "NYSE", country: "US", type: "stock", currency: "USD", source: "sec" };
    })
    .filter((r) => r.symbol && r.symbol.length <= 10 && /^[A-Z0-9.]+$/.test(r.symbol));
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Crypto                                                             */
/* ──────────────────────────────────────────────────────────────────── */

export async function fetchCoinGeckoPage(page: number): Promise<RawSymbol[]> {
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`,
  );
  const rows: RawSymbol[] = [];
  for (const c of data) {
    const sym = (c.symbol || "").toUpperCase();
    if (!sym) continue;
    rows.push({
      symbol: sym,
      fullSymbol: `CRYPTO:${sym}`,
      name: c.name || sym,
      exchange: "CRYPTO",
      country: "GLOBAL",
      type: "crypto",
      currency: "USD",
      source: "coingecko",
      iconUrl: c.image || "",
      marketCap: c.market_cap || 0,
      volume: c.total_volume || 0,
      priorityScore: Math.log10(Math.max(1, c.market_cap || 0)),
    });
  }
  return rows;
}

export async function fetchCoinGeckoList(): Promise<RawSymbol[]> {
  const list: { symbol: string; name: string }[] = await fetchJson("https://api.coingecko.com/api/v3/coins/list");
  return list
    .map((c) => {
      const sym = (c.symbol || "").toUpperCase();
      return { symbol: sym, fullSymbol: `CRYPTO:${sym}`, name: c.name || sym, exchange: "CRYPTO", country: "GLOBAL", type: "crypto", currency: "USD", source: "coingecko" };
    })
    .filter((r) => r.symbol.length > 0);
}

export async function fetchBinance(): Promise<RawSymbol[]> {
  const data = await fetchJson("https://api.binance.com/api/v3/exchangeInfo");
  return (data.symbols || [])
    .filter((s: any) => s.status === "TRADING")
    .map((s: any) => ({
      symbol: s.baseAsset.toUpperCase(),
      fullSymbol: `BINANCE:${s.symbol}`,
      name: `${s.baseAsset}/${s.quoteAsset}`,
      exchange: "BINANCE",
      country: "GLOBAL",
      type: "crypto",
      currency: s.quoteAsset,
      source: "binance",
    }));
}

export async function fetchCoinbase(): Promise<RawSymbol[]> {
  const data = await fetchJson("https://api.exchange.coinbase.com/products");
  return (data || [])
    .filter((p: any) => !p.trading_disabled)
    .map((p: any) => ({
      symbol: (p.base_currency || "").toUpperCase(),
      fullSymbol: `COINBASE:${p.id}`,
      name: `${p.base_currency}/${p.quote_currency}`,
      exchange: "COINBASE",
      country: "GLOBAL",
      type: "crypto",
      currency: p.quote_currency || "USD",
      source: "coinbase",
    }));
}

export async function fetchKraken(): Promise<RawSymbol[]> {
  const data = await fetchJson("https://api.kraken.com/0/public/AssetPairs");
  return Object.entries(data.result || {}).map(([k, v]: [string, any]) => ({
    symbol: (v.base || k.slice(0, 3)).toUpperCase(),
    fullSymbol: `KRAKEN:${k}`,
    name: k,
    exchange: "KRAKEN",
    country: "GLOBAL",
    type: "crypto",
    currency: "USD",
    source: "kraken",
  }));
}

export async function fetchOKX(): Promise<RawSymbol[]> {
  const data = await fetchJson("https://www.okx.com/api/v5/public/instruments?instType=SPOT");
  return (data.data || []).map((i: any) => ({
    symbol: (i.baseCcy || "").toUpperCase(),
    fullSymbol: `OKX:${i.instId}`,
    name: `${i.baseCcy}/${i.quoteCcy}`,
    exchange: "OKX",
    country: "GLOBAL",
    type: "crypto",
    currency: i.quoteCcy || "USDT",
    source: "okx",
  }));
}

export async function fetchBybit(): Promise<RawSymbol[]> {
  const data = await fetchJson("https://api.bybit.com/v5/market/instruments-info?category=spot");
  return (data.result?.list || []).map((i: any) => ({
    symbol: (i.baseCoin || "").toUpperCase(),
    fullSymbol: `BYBIT:${i.symbol}`,
    name: `${i.baseCoin}/${i.quoteCoin}`,
    exchange: "BYBIT",
    country: "GLOBAL",
    type: "crypto",
    currency: i.quoteCoin || "USDT",
    source: "bybit",
  }));
}

export async function fetchGateio(): Promise<RawSymbol[]> {
  const data = await fetchJson("https://api.gateio.ws/api/v4/spot/currency_pairs");
  return (data || []).map((p: any) => ({
    symbol: (p.base || "").toUpperCase(),
    fullSymbol: `GATEIO:${p.id}`,
    name: `${p.base}/${p.quote}`,
    exchange: "GATEIO",
    country: "GLOBAL",
    type: "crypto",
    currency: p.quote || "USDT",
    source: "gateio",
  }));
}

export async function fetchKucoin(): Promise<RawSymbol[]> {
  const data = await fetchJson("https://api.kucoin.com/api/v1/symbols");
  return (data.data || [])
    .filter((s: any) => s.enableTrading)
    .map((s: any) => ({
      symbol: (s.baseCurrency || "").toUpperCase(),
      fullSymbol: `KUCOIN:${s.symbol}`,
      name: `${s.baseCurrency}/${s.quoteCurrency}`,
      exchange: "KUCOIN",
      country: "GLOBAL",
      type: "crypto",
      currency: s.quoteCurrency || "USDT",
      source: "kucoin",
    }));
}

export async function fetchMexc(): Promise<RawSymbol[]> {
  const data = await fetchJson("https://api.mexc.com/api/v3/exchangeInfo");
  return (data.symbols || [])
    .filter((s: any) => s.status === "1" || s.isSpotTradingAllowed)
    .map((s: any) => ({
      symbol: (s.baseAsset || "").toUpperCase(),
      fullSymbol: `MEXC:${s.symbol}`,
      name: `${s.baseAsset}/${s.quoteAsset}`,
      exchange: "MEXC",
      country: "GLOBAL",
      type: "crypto",
      currency: s.quoteAsset || "USDT",
      source: "mexc",
    }));
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Indian Markets                                                     */
/* ──────────────────────────────────────────────────────────────────── */

export async function fetchNSE(): Promise<RawSymbol[]> {
  const csv = await fetchText("https://archives.nseindia.com/content/equities/EQUITY_L.csv");
  const rows: RawSymbol[] = [];
  for (const line of csv.split("\n").slice(1)) {
    const parts = line.split(",");
    if (parts.length < 2) continue;
    const sym = parts[0]?.trim()?.replace(/"/g, "");
    const name = parts[1]?.trim()?.replace(/"/g, "") || sym;
    if (!sym || sym.length > 20) continue;
    rows.push({ symbol: sym, fullSymbol: `NSE:${sym}`, name, exchange: "NSE", country: "IN", type: "stock", currency: "INR", source: "nse" });
  }
  return rows;
}

export async function fetchBSE(): Promise<RawSymbol[]> {
  const data = await fetchJson("https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Atea=&Flag=&scripcode=");
  return (data.Table || data || [])
    .slice(0, 5000)
    .map((s: any) => ({
      symbol: (s.scrip_cd || s.SCRIP_CD || "").toString().trim(),
      fullSymbol: `BSE:${(s.scrip_cd || s.SCRIP_CD || "").toString().trim()}`,
      name: s.Scrip_Name || s.SCRIP_NAME || s.scrip_cd || "",
      exchange: "BSE",
      country: "IN",
      type: "stock",
      currency: "INR",
      source: "bse",
    }))
    .filter((r: RawSymbol) => r.symbol && r.name);
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Curated datasets                                                   */
/* ──────────────────────────────────────────────────────────────────── */

export function generateForex(): RawSymbol[] {
  const majors = ["EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD"];
  const crosses = ["SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY", "ZAR", "MXN", "BRL", "INR", "CNY", "HKD", "SGD", "THB", "MYR", "IDR", "PHP", "TWD", "KRW", "ILS", "AED", "SAR", "RUB", "EGP", "NGN", "KES", "ARS", "CLP", "COP", "PEN", "VND", "PKR", "BDT", "LKR", "MMK", "KZT", "UAH", "RON"];
  const rows: RawSymbol[] = [];
  for (const q of [...majors, ...crosses]) {
    rows.push({ symbol: `USD${q}`, fullSymbol: `FOREX:USD${q}`, name: `US Dollar / ${q}`, exchange: "FOREX", country: "GLOBAL", type: "forex", currency: q, source: "curated" });
  }
  for (const b of majors) {
    for (const q of majors.filter((x) => x !== b)) {
      const pair = `${b}${q}`;
      if (!rows.find((r) => r.symbol === pair)) {
        rows.push({ symbol: pair, fullSymbol: `FOREX:${pair}`, name: `${b} / ${q}`, exchange: "FOREX", country: "GLOBAL", type: "forex", currency: q, source: "curated" });
      }
    }
  }
  for (const metal of ["XAU", "XAG", "XPT", "XPD"]) {
    rows.push({ symbol: `${metal}USD`, fullSymbol: `FOREX:${metal}USD`, name: `${metal} / USD`, exchange: "FOREX", country: "GLOBAL", type: "forex", currency: "USD", source: "curated" });
  }
  return rows;
}

export function generateIndices(): RawSymbol[] {
  const indices = [
    { sym: "SPX", name: "S&P 500", exchange: "SP", country: "US" },
    { sym: "DJI", name: "Dow Jones Industrial Average", exchange: "DJI", country: "US" },
    { sym: "IXIC", name: "NASDAQ Composite", exchange: "NASDAQ", country: "US" },
    { sym: "RUT", name: "Russell 2000", exchange: "RUSSELL", country: "US" },
    { sym: "VIX", name: "CBOE Volatility Index", exchange: "CBOE", country: "US" },
    { sym: "FTSE", name: "FTSE 100", exchange: "LSE", country: "GB" },
    { sym: "GDAXI", name: "DAX", exchange: "XETRA", country: "DE" },
    { sym: "FCHI", name: "CAC 40", exchange: "EURONEXT", country: "FR" },
    { sym: "N225", name: "Nikkei 225", exchange: "TSE", country: "JP" },
    { sym: "HSI", name: "Hang Seng", exchange: "HKEX", country: "HK" },
    { sym: "SSEC", name: "Shanghai Composite", exchange: "SSE", country: "CN" },
    { sym: "NIFTY", name: "NIFTY 50", exchange: "NSE", country: "IN" },
    { sym: "SENSEX", name: "BSE SENSEX", exchange: "BSE", country: "IN" },
    { sym: "KOSPI", name: "KOSPI", exchange: "KRX", country: "KR" },
    { sym: "TWII", name: "TAIEX", exchange: "TWSE", country: "TW" },
    { sym: "STI", name: "Straits Times", exchange: "SGX", country: "SG" },
    { sym: "AORD", name: "All Ordinaries", exchange: "ASX", country: "AU" },
    { sym: "BVSP", name: "Bovespa", exchange: "BOVESPA", country: "BR" },
    { sym: "TSX", name: "S&P/TSX Composite", exchange: "TSX", country: "CA" },
    { sym: "STOXX50E", name: "Euro Stoxx 50", exchange: "EURONEXT", country: "EU" },
    { sym: "IBEX35", name: "IBEX 35", exchange: "BME", country: "ES" },
    { sym: "FTSEMIB", name: "FTSE MIB", exchange: "MIL", country: "IT" },
    { sym: "AEX", name: "AEX Amsterdam", exchange: "EURONEXT", country: "NL" },
    { sym: "BEL20", name: "BEL 20", exchange: "EURONEXT", country: "BE" },
    { sym: "OMXS30", name: "OMX Stockholm 30", exchange: "STO", country: "SE" },
    { sym: "OMXC20", name: "OMX Copenhagen 20", exchange: "CPH", country: "DK" },
    { sym: "OMXH25", name: "OMX Helsinki 25", exchange: "HEL", country: "FI" },
    { sym: "OBX", name: "OBX Oslo", exchange: "OSL", country: "NO" },
    { sym: "WIG20", name: "WIG 20", exchange: "WSE", country: "PL" },
    { sym: "ATX", name: "ATX Vienna", exchange: "VIE", country: "AT" },
    { sym: "PSI20", name: "PSI 20", exchange: "EURONEXT", country: "PT" },
    { sym: "SMI", name: "Swiss Market Index", exchange: "SIX", country: "CH" },
    { sym: "XJO", name: "S&P/ASX 200", exchange: "ASX", country: "AU" },
    { sym: "NZ50", name: "NZX 50", exchange: "NZX", country: "NZ" },
    { sym: "JKSE", name: "Jakarta Composite", exchange: "IDX", country: "ID" },
    { sym: "SET", name: "SET Index", exchange: "SET", country: "TH" },
    { sym: "KLCI", name: "KLCI", exchange: "KLSE", country: "MY" },
    { sym: "PSEI", name: "PSEi", exchange: "PSE", country: "PH" },
    { sym: "TASI", name: "Tadawul All Share", exchange: "TADAWUL", country: "SA" },
    { sym: "QSI", name: "QE Index", exchange: "QSE", country: "QA" },
    { sym: "ADI", name: "ADX General", exchange: "ADX", country: "AE" },
    { sym: "EGX30", name: "EGX 30", exchange: "EGX", country: "EG" },
    { sym: "JSE", name: "JSE All-Share", exchange: "JSE", country: "ZA" },
    { sym: "MERVAL", name: "MERVAL", exchange: "BCBA", country: "AR" },
    { sym: "IPC", name: "IPC Mexico", exchange: "BMV", country: "MX" },
    { sym: "IPSA", name: "IPSA Chile", exchange: "BCS", country: "CL" },
    { sym: "COLCAP", name: "COLCAP", exchange: "BVC", country: "CO" },
  ];
  return indices.map((i) => ({
    symbol: i.sym,
    fullSymbol: `INDEX:${i.sym}`,
    name: i.name,
    exchange: i.exchange,
    country: i.country,
    type: "index",
    currency: "USD",
    source: "curated",
    priorityScore: 50,
  }));
}

export function generateBondsEconomy(): RawSymbol[] {
  const bonds = [
    "US1M", "US3M", "US6M", "US1Y", "US2Y", "US3Y", "US5Y", "US7Y", "US10Y", "US20Y", "US30Y",
    "GB1Y", "GB2Y", "GB5Y", "GB10Y", "GB30Y",
    "DE1Y", "DE2Y", "DE5Y", "DE10Y", "DE30Y",
    "JP1Y", "JP2Y", "JP5Y", "JP10Y", "JP30Y",
    "AU2Y", "AU5Y", "AU10Y", "CA2Y", "CA5Y", "CA10Y",
    "FR2Y", "FR5Y", "FR10Y", "IT2Y", "IT5Y", "IT10Y",
    "ES2Y", "ES5Y", "ES10Y", "IN1Y", "IN5Y", "IN10Y",
    "CN1Y", "CN2Y", "CN5Y", "CN10Y", "BR2Y", "BR5Y", "BR10Y",
    "MX2Y", "MX5Y", "MX10Y", "ZA2Y", "ZA5Y", "ZA10Y",
  ];
  const economy = [
    { sym: "GDP", name: "US GDP Growth Rate" }, { sym: "CPI", name: "US Consumer Price Index" },
    { sym: "UNRATE", name: "US Unemployment Rate" }, { sym: "FEDFUNDS", name: "Federal Funds Rate" },
    { sym: "DGS10", name: "10-Year Treasury Rate" }, { sym: "M2SL", name: "M2 Money Supply" },
    { sym: "UMCSENT", name: "Consumer Sentiment" }, { sym: "PAYEMS", name: "Nonfarm Payrolls" },
    { sym: "INDPRO", name: "Industrial Production" }, { sym: "HOUST", name: "Housing Starts" },
    { sym: "RSAFS", name: "Retail Sales" }, { sym: "DFII10", name: "10Y Breakeven Inflation" },
    { sym: "DTWEXBGS", name: "US Dollar Index" }, { sym: "BAMLH0A0HYM2", name: "High Yield Spread" },
    { sym: "T10Y2Y", name: "10Y-2Y Yield Curve" }, { sym: "VIXCLS", name: "VIX Close" },
  ];
  return [
    ...bonds.map((b) => ({
      symbol: b, fullSymbol: `BOND:${b}`, name: `${b.slice(0, 2)} ${b.slice(2)} Treasury Yield`,
      exchange: "BOND", country: b.slice(0, 2), type: "bond" as const, currency: "USD", source: "curated",
    })),
    ...economy.map((e) => ({
      symbol: e.sym, fullSymbol: `ECONOMY:${e.sym}`, name: e.name,
      exchange: "FRED", country: "US", type: "economy" as const, currency: "USD", source: "curated",
    })),
  ];
}

export function generateETFs(): RawSymbol[] {
  const etfSymbols = [
    "SPY", "QQQ", "IWM", "DIA", "VOO", "VTI", "IVV", "VEA", "VWO", "EFA", "EEM", "AGG", "BND", "LQD", "HYG", "TLT", "IEF", "SHY", "GLD", "SLV", "USO", "UNG",
    "XLE", "XLF", "XLK", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC",
    "ARKK", "ARKG", "ARKW", "ARKF", "ARKQ", "ARKX", "SOXX", "SMH", "XBI", "IBB", "HACK", "BOTZ", "ROBO", "ICLN", "TAN", "QCLN", "PBW",
    "VIG", "VYM", "DVY", "SDY", "SCHD", "HDV", "NOBL", "DGRO", "SPHD", "SPYD",
    "VNQ", "IYR", "REM", "MORT", "REET", "VNQI",
    "EMB", "PCY", "BNDX", "IGOV", "BWX", "EMLC", "JNK", "SJNK", "USIG", "VCSH", "VCIT", "VCLT",
    "VIXY", "UVXY", "VXX", "SVXY", "SQQQ", "TQQQ", "SPXS", "SPXL", "SDS", "SSO", "DDM", "DXD", "SH", "PSQ", "DOG", "QID", "QLD",
    "EWJ", "EWG", "EWU", "EWA", "EWC", "EWZ", "EWY", "EWT", "EWH", "EWS", "EWM", "INDA", "MCHI",
    "FXI", "ASHR", "KWEB", "CQQQ", "GXC",
    "XME", "COPX", "LIT", "URA", "REMX", "SIL", "SILJ", "GDX", "GDXJ", "PICK",
  ];
  return etfSymbols.map((s) => ({
    symbol: s, fullSymbol: `NYSE:${s}`, name: `${s} ETF`,
    exchange: "NYSE", country: "US", type: "etf", currency: "USD", source: "curated-etf",
    priorityScore: 20,
  }));
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Dispatcher — route source name to fetcher                          */
/* ──────────────────────────────────────────────────────────────────── */

export type { RawSymbol };
