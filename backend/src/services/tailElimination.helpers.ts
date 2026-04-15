// Tail Elimination — shared constants and pure helper functions

export const EXCHANGE_FAVICON: Record<string, string> = {
  NYSE: "https://www.google.com/s2/favicons?domain=nyse.com&sz=128",
  NASDAQ: "https://www.google.com/s2/favicons?domain=nasdaq.com&sz=128",
  NSE: "https://www.google.com/s2/favicons?domain=nseindia.com&sz=128",
  BSE: "https://www.google.com/s2/favicons?domain=bseindia.com&sz=128",
  LSE: "https://www.google.com/s2/favicons?domain=londonstockexchange.com&sz=128",
  XETRA: "https://www.google.com/s2/favicons?domain=deutsche-boerse.com&sz=128",
  EURONEXT: "https://www.google.com/s2/favicons?domain=euronext.com&sz=128",
  HKEX: "https://www.google.com/s2/favicons?domain=hkex.com.hk&sz=128",
  TSE: "https://www.google.com/s2/favicons?domain=jpx.co.jp&sz=128",
  ASX: "https://www.google.com/s2/favicons?domain=asx.com.au&sz=128",
  BINANCE: "https://www.google.com/s2/favicons?domain=binance.com&sz=128",
  FOREX: "https://www.google.com/s2/favicons?domain=xe.com&sz=128",
};
export const DEFAULT_EXCHANGE_ICON = "https://www.google.com/s2/favicons?domain=tradingview.com&sz=128";

export const ETF_ISSUER_DOMAINS: Record<string, string> = {
  SPY: "ssga.com", QQQ: "invesco.com", IVV: "ishares.com", VOO: "vanguard.com",
  VTI: "vanguard.com", BND: "vanguard.com", VEA: "vanguard.com", VWO: "vanguard.com",
  AGG: "ishares.com", IWM: "ishares.com", EFA: "ishares.com", GLD: "ssga.com",
  TLT: "ishares.com", XLF: "ssga.com", XLK: "ssga.com", XLE: "ssga.com",
  ARKK: "ark-invest.com", ARKW: "ark-invest.com", ARKG: "ark-invest.com",
  DIA: "ssga.com", SLV: "ishares.com", HYG: "ishares.com", LQD: "ishares.com",
  VNQ: "vanguard.com", SCHD: "schwab.com", JEPI: "jpmorgan.com",
};

export const CRYPTO_BASE_MAP: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  USDT: "https://assets.coingecko.com/coins/images/325/small/tether.png",
  BNB: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  XRP: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  ADA: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  MATIC: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
  DOT: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
  AVAX: "https://assets.coingecko.com/coins/images/12559/small/coin-round-red.png",
  LINK: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  LTC: "https://assets.coingecko.com/coins/images/2/small/litecoin.png",
  SHIB: "https://assets.coingecko.com/coins/images/11939/small/shiba.png",
};

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function tokenSimilarity(nameA: string, nameB: string): number {
  const tokensA = new Set(nameA.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean));
  const tokensB = new Set(nameB.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) { if (tokensB.has(t)) overlap++; }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|inc\.?|corp\.?|corporation|plc|company|co\.?|holdings|group|enterprises?)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCryptoBase(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  const cleaned = upper
    .replace(/[-_](PERP|PERPETUAL|SWAP|FUTURE|FUT|1[DMQY]|0[1-9]\d{2}|1[0-2]\d{2})$/i, "")
    .replace(/[-_](LONG|SHORT|BULL|BEAR|[235]X)$/i, "");
  const quoteSuffixes = ["USDT", "USDC", "BUSD", "USD", "INR", "BTC", "ETH", "BNB", "EUR", "TRY", "GBP"];
  for (const suffix of quoteSuffixes) {
    if (cleaned.endsWith(suffix) && cleaned.length > suffix.length + 1) {
      return cleaned.slice(0, -suffix.length);
    }
  }
  return cleaned;
}

export function isEtfLike(input: { symbol: string; name: string; type: string }): boolean {
  if (/\betf\b/i.test(input.name)) return true;
  if (input.type === "fund" || input.type === "etf") return true;
  return false;
}

export function isForexLike(input: { symbol: string; type: string; exchange: string }): boolean {
  if (input.type === "forex") return true;
  if (/^(FOREX|FX)$/i.test(input.exchange)) return true;
  return /[A-Z]{3}[/\\]?[A-Z]{3}/.test(input.symbol);
}

export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}