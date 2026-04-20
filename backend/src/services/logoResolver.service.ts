/**
 * logoResolver.service.ts — Tiered logo resolution for 100% coverage.
 *
 * TIER 0: Existing valid S3/external URL
 * TIER 1: Hard-coded symbol map (indices, commodities, major crypto)
 * TIER 2: Type-based resolution (crypto coin icons, forex central bank, etc.)
 * TIER 3: Google Favicon domain lookup (company domain OR derived from name)
 * TIER 3b: Google Favicon with multi-candidate domain (derived from company name)
 * TIER 4: FMP image stock (works for many US stocks regardless of API key status)
 * TIER 4b: Google favicon via domain or exchange
 * TIER 5: Deterministic SVG monogram (guarantees 100% coverage)
 */
import { deriveDomain, deriveDomainCandidates } from "./companyNormalizer.service";
import { retry } from "../utils/retry.util";

/* ── Wrong-Logo Guardrails ─────────────────────────────────────────── */

/** Domains that belong to data providers, not companies. Never use as company logos. */
const BAD_DOMAINS = new Set([
  "financialmodelingprep.com", "fmpcloud.io", "example.com", "localhost",
  "tradereplay.me", "tradereplay.com", "google.com", "duckduckgo.com",
  "clearbit.com", "logo.dev", "img.logo.dev", "api.polygon.io",
  "polygon.io", "alphavantage.co", "iexcloud.io", "marketstack.com",
  "yahoo.com", "finance.yahoo.com", "api.coingecko.com",
  "none", "null", "",
]);

/** Dead CDN hostnames whose URLs always return 403/404. */
const DEAD_CDN_HOSTS = ["dl142w45levth.cloudfront.net"];

/** Check if a domain is a bad provider/data-source domain. */
export function isBadDomain(domain: string | undefined | null): boolean {
  if (!domain) return true;
  const d = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return BAD_DOMAINS.has(d) || d.length < 3;
}

/** Check if a URL points to a known dead CDN. */
function isDeadCdnUrl(url: string): boolean {
  return DEAD_CDN_HOSTS.some(host => url.includes(host));
}

/** Extract the domain= param from a Google Favicon URL. */
function extractFaviconDomain(url: string): string | null {
  const m = url.match(/[?&]domain=([^&]+)/);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

/** Validate an existing logo URL against guardrails. Returns true if the URL is safe to use. */
export function isLogoUrlSafe(url: string): boolean {
  if (!url || !url.startsWith("http")) return false;
  if (isDeadCdnUrl(url)) return false;
  // If it's a Google Favicon URL, check the domain param isn't bad
  const faviconDomain = extractFaviconDomain(url);
  if (faviconDomain && isBadDomain(faviconDomain)) return false;
  // Reject URLs that are literally from a data-provider domain
  for (const bad of BAD_DOMAINS) {
    if (bad && url.includes(`//${bad}`)) return false;
  }
  return true;
}

/* ── TIER 1 — Symbol Map ───────────────────────────────────────────── */

const SYMBOL_LOGO_MAP: Record<string, string> = {
  // Major indices
  NIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  NIFTY50: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  "NIFTY 50": "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SENSEX: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/BSE_Logo.svg/120px-BSE_Logo.svg.png",
  BANKNIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  "BANK NIFTY": "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  NIFTYBANK: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SPX: "https://www.google.com/s2/favicons?sz=128&domain=spglobal.com",
  DJI: "https://www.google.com/s2/favicons?sz=128&domain=spglobal.com",
  DJIA: "https://www.google.com/s2/favicons?sz=128&domain=spglobal.com",
  IXIC: "https://www.google.com/s2/favicons?sz=128&domain=nasdaq.com",
  FTSE: "https://www.google.com/s2/favicons?sz=128&domain=lseg.com",
  FTSE100: "https://www.google.com/s2/favicons?sz=128&domain=lseg.com",
  DAX: "https://www.google.com/s2/favicons?sz=128&domain=deutsche-boerse.com",
  CAC40: "https://www.google.com/s2/favicons?sz=128&domain=euronext.com",
  N225: "https://www.google.com/s2/favicons?sz=128&domain=jpx.co.jp",
  NIKKEI: "https://www.google.com/s2/favicons?sz=128&domain=jpx.co.jp",
  HSI: "https://www.google.com/s2/favicons?sz=128&domain=hkex.com.hk",
  KOSPI: "https://www.google.com/s2/favicons?sz=128&domain=krx.co.kr",
  STI: "https://www.google.com/s2/favicons?sz=128&domain=sgx.com",
  ASX200: "https://www.google.com/s2/favicons?sz=128&domain=asx.com.au",
  IBOVESPA: "https://www.google.com/s2/favicons?sz=128&domain=b3.com.br",
  TSX: "https://www.google.com/s2/favicons?sz=128&domain=tsx.com",
  DXY: "https://www.google.com/s2/favicons?sz=128&domain=ice.com",
  VIX: "https://www.google.com/s2/favicons?sz=128&domain=cboe.com",
  RUT: "https://www.google.com/s2/favicons?sz=128&domain=ftserussell.com",
  NDX: "https://www.google.com/s2/favicons?sz=128&domain=nasdaq.com",
  RUSSELL2000: "https://www.google.com/s2/favicons?sz=128&domain=ftserussell.com",

  // Commodities / metals
  XAUUSD: "https://www.google.com/s2/favicons?sz=128&domain=gold.org",
  XAGUSD: "https://www.google.com/s2/favicons?sz=128&domain=silverinstitute.org",
  GOLD: "https://www.google.com/s2/favicons?sz=128&domain=gold.org",
  SILVER: "https://www.google.com/s2/favicons?sz=128&domain=silverinstitute.org",
  CRUDEOIL: "https://www.google.com/s2/favicons?sz=128&domain=opec.org",
  NATURALGAS: "https://www.google.com/s2/favicons?sz=128&domain=eia.gov",
  COPPER: "https://www.google.com/s2/favicons?sz=128&domain=lme.com",

  // Bonds
  EUROBOND: "https://www.google.com/s2/favicons?sz=128&domain=ecb.europa.eu",
  TBOND: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  TNOTE: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  TBILL: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  BUND: "https://www.google.com/s2/favicons?sz=128&domain=bundesbank.de",
  GILT: "https://www.google.com/s2/favicons?sz=128&domain=bankofengland.co.uk",
  JGB: "https://www.google.com/s2/favicons?sz=128&domain=boj.or.jp",

  // Top Indian stocks (NSE/BSE symbols → Google Favicon of verified domain)
  TCS: "https://www.google.com/s2/favicons?sz=128&domain=tcs.com",
  RELIANCE: "https://www.google.com/s2/favicons?sz=128&domain=ril.com",
  HDFCBANK: "https://www.google.com/s2/favicons?sz=128&domain=hdfcbank.com",
  INFY: "https://www.google.com/s2/favicons?sz=128&domain=infosys.com",
  ICICIBANK: "https://www.google.com/s2/favicons?sz=128&domain=icicibank.com",
  SBIN: "https://www.google.com/s2/favicons?sz=128&domain=sbi.co.in",
  ITC: "https://www.google.com/s2/favicons?sz=128&domain=itcportal.com",
  KOTAKBANK: "https://www.google.com/s2/favicons?sz=128&domain=kotak.com",
  LT: "https://www.google.com/s2/favicons?sz=128&domain=larsentoubro.com",
  AXISBANK: "https://www.google.com/s2/favicons?sz=128&domain=axisbank.com",
  BHARTIARTL: "https://www.google.com/s2/favicons?sz=128&domain=airtel.in",
  BAJFINANCE: "https://www.google.com/s2/favicons?sz=128&domain=bajajfinserv.in",
  HCLTECH: "https://www.google.com/s2/favicons?sz=128&domain=hcltech.com",
  WIPRO: "https://www.google.com/s2/favicons?sz=128&domain=wipro.com",
  MARUTI: "https://www.google.com/s2/favicons?sz=128&domain=marutisuzuki.com",
  SUNPHARMA: "https://www.google.com/s2/favicons?sz=128&domain=sunpharma.com",
  MANDM: "https://www.google.com/s2/favicons?sz=128&domain=mahindra.com",
  TATAMOTORS: "https://www.google.com/s2/favicons?sz=128&domain=tatamotors.com",
  TATASTEEL: "https://www.google.com/s2/favicons?sz=128&domain=tatasteel.com",
  HINDUNILVR: "https://www.google.com/s2/favicons?sz=128&domain=hul.co.in",
  NTPC: "https://www.google.com/s2/favicons?sz=128&domain=ntpc.co.in",
  POWERGRID: "https://www.google.com/s2/favicons?sz=128&domain=powergrid.in",
  ULTRACEMCO: "https://www.google.com/s2/favicons?sz=128&domain=ultratechcement.com",
  ASIANPAINT: "https://www.google.com/s2/favicons?sz=128&domain=asianpaints.com",
  ADANIENT: "https://www.google.com/s2/favicons?sz=128&domain=adani.com",
  ADANIPORTS: "https://www.google.com/s2/favicons?sz=128&domain=adaniports.com",
  TECHM: "https://www.google.com/s2/favicons?sz=128&domain=techmahindra.com",
  TITAN: "https://www.google.com/s2/favicons?sz=128&domain=titancompany.in",
  ONGC: "https://www.google.com/s2/favicons?sz=128&domain=ongcindia.com",
  COALINDIA: "https://www.google.com/s2/favicons?sz=128&domain=coalindia.in",
  BPCL: "https://www.google.com/s2/favicons?sz=128&domain=bharatpetroleum.in",
  IOC: "https://www.google.com/s2/favicons?sz=128&domain=iocl.com",
  CIPLA: "https://www.google.com/s2/favicons?sz=128&domain=cipla.com",
  DRREDDY: "https://www.google.com/s2/favicons?sz=128&domain=drreddys.com",
  JSWSTEEL: "https://www.google.com/s2/favicons?sz=128&domain=jsw.in",
  GRASIM: "https://www.google.com/s2/favicons?sz=128&domain=grasim.com",
  HINDALCO: "https://www.google.com/s2/favicons?sz=128&domain=hindalco.com",
  DIVISLAB: "https://www.google.com/s2/favicons?sz=128&domain=divislabs.com",
  BRITANNIA: "https://www.google.com/s2/favicons?sz=128&domain=britannia.co.in",
  HEROMOTOCO: "https://www.google.com/s2/favicons?sz=128&domain=heromotocorp.com",
  EICHERMOT: "https://www.google.com/s2/favicons?sz=128&domain=eichermotors.com",
  APOLLOHOSP: "https://www.google.com/s2/favicons?sz=128&domain=apollohospitals.com",
  NESTLEIND: "https://www.google.com/s2/favicons?sz=128&domain=nestle.in",
  BAJAJFINSV: "https://www.google.com/s2/favicons?sz=128&domain=bajajfinserv.in",
  BAJAJ: "https://www.google.com/s2/favicons?sz=128&domain=bajajauto.com",
  ZOMATO: "https://www.google.com/s2/favicons?sz=128&domain=zomato.com",
  PAYTM: "https://www.google.com/s2/favicons?sz=128&domain=paytm.com",
  INDUSINDBK: "https://www.google.com/s2/favicons?sz=128&domain=indusind.com",
  PNB: "https://www.google.com/s2/favicons?sz=128&domain=pnbindia.in",
  BANKBARODA: "https://www.google.com/s2/favicons?sz=128&domain=bankofbaroda.in",

  // Major crypto
  BTC: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  BNB: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  XRP: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  ADA: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
  AVAX: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  DOT: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
  LINK: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  MATIC: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
  UNI: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png",
  USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
};

/* ── TIER 2 — Type-Based Resolution ────────────────────────────────── */

/** Forex flag pair icons — using Wise/XE style flag composites */
const FOREX_CURRENCY_FLAGS: Record<string, string> = {
  USD: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  EUR: "https://www.google.com/s2/favicons?sz=128&domain=ecb.europa.eu",
  GBP: "https://www.google.com/s2/favicons?sz=128&domain=bankofengland.co.uk",
  JPY: "https://www.google.com/s2/favicons?sz=128&domain=boj.or.jp",
  CHF: "https://www.google.com/s2/favicons?sz=128&domain=snb.ch",
  AUD: "https://www.google.com/s2/favicons?sz=128&domain=rba.gov.au",
  CAD: "https://www.google.com/s2/favicons?sz=128&domain=bankofcanada.ca",
  NZD: "https://www.google.com/s2/favicons?sz=128&domain=rbnz.govt.nz",
  CNY: "https://www.google.com/s2/favicons?sz=128&domain=pbc.gov.cn",
  INR: "https://www.google.com/s2/favicons?sz=128&domain=rbi.org.in",
};

const TYPE_FALLBACK_ICONS: Record<string, string> = {
  index: "https://www.google.com/s2/favicons?sz=128&domain=spglobal.com",
  bond: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  economy: "https://www.google.com/s2/favicons?sz=128&domain=worldbank.org",
  futures: "https://www.google.com/s2/favicons?sz=128&domain=cmegroup.com",
};

/** Exchange domain map for Google favicon resolution */
const EXCHANGE_DOMAIN: Record<string, string> = {
  NASDAQ: "nasdaq.com",
  NYSE: "nyse.com",
  NSE: "nseindia.com",
  BSE: "bseindia.com",
  LSE: "londonstockexchange.com",
  LON: "londonstockexchange.com",
  TSX: "tsx.com",
  TSXV: "tsx.com",
  CNQ: "tsx.com",
  ASX: "asx.com.au",
  XETRA: "deutsche-boerse.com",
  FRA: "deutsche-boerse.com",
  EURONEXT: "euronext.com",
  PAR: "euronext.com",
  AMS: "euronext.com",
  BRU: "euronext.com",
  LIS: "euronext.com",
  MIL: "borsaitaliana.it",
  HKEX: "hkex.com.hk",
  HKG: "hkex.com.hk",
  SGX: "sgx.com",
  SES: "sgx.com",
  BINANCE: "binance.com",
  COINBASE: "coinbase.com",
  KRAKEN: "kraken.com",
  BYBIT: "bybit.com",
  OKX: "okx.com",
  GATEIO: "gate.io",
  KUCOIN: "kucoin.com",
  COINGECKO: "coingecko.com",
  // Japanese
  TSE: "jpx.co.jp",
  TYO: "jpx.co.jp",
  JPX: "jpx.co.jp",
  // Korean
  KRX: "krx.co.kr",
  KSC: "krx.co.kr",
  KOE: "krx.co.kr",
  KOSDAQ: "krx.co.kr",
  // Chinese
  SSE: "sse.com.cn",
  SHH: "sse.com.cn",
  SHZ: "szse.cn",
  SZSE: "szse.cn",
  // Taiwan
  TWSE: "twse.com.tw",
  TWO: "twse.com.tw",
  TAI: "twse.com.tw",
  // Southeast Asian
  SET: "set.or.th",
  BKK: "set.or.th",
  IDX: "idx.co.id",
  JKT: "idx.co.id",
  BURSA: "bursamalaysia.com",
  KLS: "bursamalaysia.com",
  PSE: "pse.com.ph",
  // Indian
  MCX: "mcxindia.com",
  NCDEX: "ncdex.com",
  // European
  SWX: "six-group.com",
  MOEX: "moex.com",
  MCX_RU: "moex.com",
  BOLSA: "bmv.com.mx",
  BMV: "bmv.com.mx",
  B3: "b3.com.br",
  SAO: "b3.com.br",
  JSE: "jse.co.za",
  JNB: "jse.co.za",
  NZX: "nzx.com",
  NZE: "nzx.com",
  TASE: "tase.co.il",
  TLV: "tase.co.il",
  OSE: "oslobors.no",
  OSL: "oslobors.no",
  STO: "nasdaqomxnordic.com",
  HEL: "nasdaqomxnordic.com",
  CPH: "nasdaqomxnordic.com",
  IST: "borsaistanbul.com",
  // Other
  AMEX: "nyse.com",
  NYSEARCA: "nyse.com",
  OTCMARKETS: "otcmarkets.com",
  SEC: "sec.gov",
  CFD: "ig.com",
  FOREX: "xe.com",
  FX: "xe.com",
  INDEX: "spglobal.com",
};

/* ── TIER 5 — Deterministic SVG Monogram ────────────────────────────── */

/** Deterministic color from string hash */
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 40%)`;
}

function generateSvgDataUri(symbol: string, name?: string): string {
  // Use initials from company name if available, else from symbol
  let initials: string;
  if (name && name.length >= 2) {
    const words = name.trim().split(/\s+/).filter(w => w.length > 0);
    initials = words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  } else {
    initials = symbol.slice(0, 2).toUpperCase();
  }
  const bg = hashColor(symbol);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/><text x="32" y="40" text-anchor="middle" fill="#fff" font-size="24" font-family="system-ui,sans-serif" font-weight="600">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/* ── Main Resolution Function ──────────────────────────────────────── */

export interface LogoResult {
  iconUrl: string;
  logoSource: string;
  logoTier: number;
  logoConfidence: "high" | "medium" | "low" | "none";
  domainUsed?: string;
}

export function resolveLogo(asset: {
  symbol: string;
  type: string;
  exchange?: string;
  companyDomain?: string;
  iconUrl?: string;
  s3Icon?: string;
  name?: string;
  country?: string;
}): LogoResult {
  const sym = asset.symbol.toUpperCase();

  // TIER 0: Already has a valid logo (S3 or external URL) — with guardrails
  if (asset.s3Icon && isLogoUrlSafe(asset.s3Icon)) {
    return { iconUrl: asset.s3Icon, logoSource: "s3", logoTier: 0, logoConfidence: "high" };
  }
  if (asset.iconUrl && isLogoUrlSafe(asset.iconUrl) && !asset.iconUrl.includes("default")) {
    return { iconUrl: asset.iconUrl, logoSource: "existing", logoTier: 0, logoConfidence: "high" };
  }

  // TIER 1: Symbol map (well-known symbols)
  const baseSymbol = sym.replace(/(USDT|USDC|USD|BUSD|BTC|ETH)$/, "");
  if (SYMBOL_LOGO_MAP[sym]) {
    return { iconUrl: SYMBOL_LOGO_MAP[sym], logoSource: "symbolMap", logoTier: 1, logoConfidence: "high" };
  }
  if (baseSymbol && SYMBOL_LOGO_MAP[baseSymbol]) {
    return { iconUrl: SYMBOL_LOGO_MAP[baseSymbol], logoSource: "symbolMap:base", logoTier: 1, logoConfidence: "high" };
  }
  const nameUpper = (asset.name || "").toUpperCase();
  if (nameUpper && SYMBOL_LOGO_MAP[nameUpper]) {
    return { iconUrl: SYMBOL_LOGO_MAP[nameUpper], logoSource: "symbolMap:name", logoTier: 1, logoConfidence: "high" };
  }
  const nameNoSpace = nameUpper.replace(/\s+/g, "");
  if (nameNoSpace && SYMBOL_LOGO_MAP[nameNoSpace]) {
    return { iconUrl: SYMBOL_LOGO_MAP[nameNoSpace], logoSource: "symbolMap:nameCompact", logoTier: 1, logoConfidence: "high" };
  }

  // TIER 2: Type-based resolution
  if (asset.type === "crypto") {
    const coinId = sym.toLowerCase().replace(/usdt$|usdc$|usd$|busd$|btc$|eth$/i, "");
    if (coinId.length >= 2) {
      return {
        iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${coinId}.org`,
        logoSource: "crypto:favicon",
        logoTier: 2,
        logoConfidence: "low",
      };
    }
  }

  if (asset.type === "forex") {
    const base = sym.slice(0, 3).toUpperCase();
    if (FOREX_CURRENCY_FLAGS[base]) {
      return { iconUrl: FOREX_CURRENCY_FLAGS[base], logoSource: "forex:flag", logoTier: 2, logoConfidence: "medium" };
    }
  }

  if (TYPE_FALLBACK_ICONS[asset.type]) {
    return { iconUrl: TYPE_FALLBACK_ICONS[asset.type], logoSource: `type:${asset.type}`, logoTier: 2, logoConfidence: "low" };
  }

  // TIER 3: Google Favicon domain lookup (explicit domain) — with guardrails
  // NOTE: Migrated from Clearbit (DNS down since 2026-04) to Google Favicon
  if (asset.companyDomain && !isBadDomain(asset.companyDomain)) {
    const domain = asset.companyDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return {
      iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`,
      logoSource: "google:domain",
      logoTier: 3,
      logoConfidence: "high",
      domainUsed: domain,
    };
  }

  // TIER 3b: Derive domain from company name (multi-candidate) → Google Favicon
  if (asset.name) {
    const candidates = deriveDomainCandidates(asset.name, asset.country);
    if (candidates.length > 0) {
      const best = candidates[0];
      return {
        iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(best.domain)}`,
        logoSource: `google:${best.method}`,
        logoTier: 3,
        logoConfidence: best.confidence === "high" ? "high" : "medium",
        domainUsed: best.domain,
      };
    }
  }

  // TIER 4: FMP image stock (works for US-listed stocks even without API key)
  if ((asset.type === "stock" || asset.type === "etf") && sym.length <= 6 && /^[A-Z]+$/.test(sym)) {
    return {
      iconUrl: `https://financialmodelingprep.com/image-stock/${sym}.png`,
      logoSource: "fmp:image",
      logoTier: 4,
      logoConfidence: "medium",
    };
  }

  // TIER 4b: Google favicon via exchange domain
  const exKey = (asset.exchange || "").toUpperCase();
  const exDomain = EXCHANGE_DOMAIN[exKey];
  if (exDomain) {
    return {
      iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${exDomain}`,
      logoSource: "exchange:favicon",
      logoTier: 4,
      logoConfidence: "low",
    };
  }

  // TIER 4c: Google favicon from derived domain
  if (asset.name) {
    const derived = deriveDomain(asset.name, asset.country);
    if (derived) {
      return {
        iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${derived}`,
        logoSource: "google:derived",
        logoTier: 4,
        logoConfidence: "low",
        domainUsed: derived,
      };
    }
  }

  // TIER 5: Deterministic SVG monogram (guarantees 100% coverage)
  return {
    iconUrl: generateSvgDataUri(sym, asset.name),
    logoSource: "generated",
    logoTier: 5,
    logoConfidence: "none",
  };
}

/* ── Async Logo Resolution with HTTP validation ────────────────────── */

async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) return false;
    const cl = parseInt(res.headers.get("content-length") || "0", 10);
    if (cl > 0 && cl < 100) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Async logo resolution — validates URLs via HTTP HEAD.
 * Falls through tiers until a reachable logo is found.
 * Use for reprocessing failures only (not hot path).
 */
export async function resolveLogoAsync(asset: {
  symbol: string;
  type: string;
  exchange?: string;
  companyDomain?: string;
  iconUrl?: string;
  s3Icon?: string;
  name?: string;
  country?: string;
}): Promise<LogoResult> {
  const sym = asset.symbol.toUpperCase();

  // TIER 0: Existing valid S3/external — with guardrails
  if (asset.s3Icon && isLogoUrlSafe(asset.s3Icon)) {
    return { iconUrl: asset.s3Icon, logoSource: "s3", logoTier: 0, logoConfidence: "high" };
  }
  if (asset.iconUrl && isLogoUrlSafe(asset.iconUrl) && !asset.iconUrl.includes("default")) {
    const ok = await retry(() => isUrlReachable(asset.iconUrl!), 2, 300).catch(() => false);
    if (ok) return { iconUrl: asset.iconUrl!, logoSource: "existing", logoTier: 0, logoConfidence: "high" };
  }

  // TIER 1: Symbol map
  const baseSymbol = sym.replace(/(USDT|USDC|USD|BUSD|BTC|ETH)$/, "");
  const mapHit = SYMBOL_LOGO_MAP[sym] || (baseSymbol ? SYMBOL_LOGO_MAP[baseSymbol] : undefined);
  if (mapHit) return { iconUrl: mapHit, logoSource: "symbolMap", logoTier: 1, logoConfidence: "high" };
  const nameUpper = (asset.name || "").toUpperCase();
  if (nameUpper && SYMBOL_LOGO_MAP[nameUpper]) return { iconUrl: SYMBOL_LOGO_MAP[nameUpper], logoSource: "symbolMap:name", logoTier: 1, logoConfidence: "high" };
  const nameNoSpace = nameUpper.replace(/\s+/g, "");
  if (nameNoSpace && SYMBOL_LOGO_MAP[nameNoSpace]) return { iconUrl: SYMBOL_LOGO_MAP[nameNoSpace], logoSource: "symbolMap:nameCompact", logoTier: 1, logoConfidence: "high" };

  // TIER 2: Type-based
  if (asset.type === "crypto") {
    const coinId = sym.toLowerCase().replace(/usdt$|usdc$|usd$|busd$|btc$|eth$/i, "");
    if (coinId.length >= 2) {
      const url = `https://www.google.com/s2/favicons?sz=128&domain=${coinId}.org`;
      return { iconUrl: url, logoSource: "crypto:favicon", logoTier: 2, logoConfidence: "low" };
    }
  }
  if (asset.type === "forex") {
    const base = sym.slice(0, 3).toUpperCase();
    if (FOREX_CURRENCY_FLAGS[base]) return { iconUrl: FOREX_CURRENCY_FLAGS[base], logoSource: "forex:flag", logoTier: 2, logoConfidence: "medium" };
  }
  if (TYPE_FALLBACK_ICONS[asset.type]) {
    return { iconUrl: TYPE_FALLBACK_ICONS[asset.type], logoSource: `type:${asset.type}`, logoTier: 2, logoConfidence: "low" };
  }

  // TIER 3: Google Favicon (explicit domain — validated) — with guardrails
  // NOTE: Migrated from Clearbit (DNS down since 2026-04) to Google Favicon
  if (asset.companyDomain && !isBadDomain(asset.companyDomain)) {
    const domain = asset.companyDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const gUrl = `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`;
    const ok = await retry(() => isUrlReachable(gUrl), 2, 300).catch(() => false);
    if (ok) return { iconUrl: gUrl, logoSource: "google:domain", logoTier: 3, logoConfidence: "high", domainUsed: domain };
  }

  // TIER 3b: Google Favicon with multi-candidate domain — validated
  if (asset.name) {
    const candidates = deriveDomainCandidates(asset.name, asset.country);
    for (const cand of candidates) {
      const gUrl = `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(cand.domain)}`;
      const ok = await retry(() => isUrlReachable(gUrl), 2, 300).catch(() => false);
      if (ok) {
        return {
          iconUrl: gUrl,
          logoSource: `google:${cand.method}`,
          logoTier: 3,
          logoConfidence: cand.confidence === "high" ? "high" : "medium",
          domainUsed: cand.domain,
        };
      }
    }
  }

  // TIER 4: FMP image stock
  if ((asset.type === "stock" || asset.type === "etf") && sym.length <= 6 && /^[A-Z]+$/.test(sym)) {
    const fmpUrl = `https://financialmodelingprep.com/image-stock/${sym}.png`;
    const ok = await retry(() => isUrlReachable(fmpUrl), 2, 300).catch(() => false);
    if (ok) return { iconUrl: fmpUrl, logoSource: "fmp:image", logoTier: 4, logoConfidence: "medium" };
  }

  // TIER 4b: Google favicon via exchange
  const exKey = (asset.exchange || "").toUpperCase();
  const exDomain = EXCHANGE_DOMAIN[exKey];
  if (exDomain) {
    return { iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${exDomain}`, logoSource: "exchange:favicon", logoTier: 4, logoConfidence: "low" };
  }

  // TIER 4c: Google favicon from derived domain
  if (asset.name) {
    const derived = deriveDomain(asset.name, asset.country);
    if (derived) {
      return { iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${derived}`, logoSource: "google:derived", logoTier: 4, logoConfidence: "low", domainUsed: derived };
    }
  }

  // TIER 5: Generated SVG
  return { iconUrl: generateSvgDataUri(sym, asset.name), logoSource: "generated", logoTier: 5, logoConfidence: "none" };
}
