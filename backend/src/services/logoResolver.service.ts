/**
 * logoResolver.service.ts — Tiered logo resolution for 100% coverage.
 *
 * TIER 0: Existing valid S3/external URL
 * TIER 1: Hard-coded symbol map (indices, commodities, major crypto)
 * TIER 2: Type-based resolution (crypto coin icons, forex flags, etc.)
 * TIER 3: Clearbit domain lookup (company domain OR normalized name)
 * TIER 4: Google favicon via exchange domain
 * TIER 5: Generated initial-based icon (guarantees 100%)
 */
import { deriveDomain } from "./companyNormalizer.service";

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
  SPX: "https://logo.clearbit.com/spglobal.com",
  DJI: "https://logo.clearbit.com/spglobal.com",
  DJIA: "https://logo.clearbit.com/spglobal.com",
  IXIC: "https://logo.clearbit.com/nasdaq.com",
  FTSE: "https://logo.clearbit.com/lseg.com",
  FTSE100: "https://logo.clearbit.com/lseg.com",
  DAX: "https://logo.clearbit.com/deutsche-boerse.com",
  CAC40: "https://logo.clearbit.com/euronext.com",
  N225: "https://logo.clearbit.com/jpx.co.jp",
  NIKKEI: "https://logo.clearbit.com/jpx.co.jp",
  HSI: "https://logo.clearbit.com/hkex.com.hk",
  KOSPI: "https://logo.clearbit.com/krx.co.kr",
  STI: "https://logo.clearbit.com/sgx.com",
  ASX200: "https://logo.clearbit.com/asx.com.au",
  IBOVESPA: "https://logo.clearbit.com/b3.com.br",
  TSX: "https://logo.clearbit.com/tsx.com",
  DXY: "https://www.google.com/s2/favicons?sz=128&domain=ice.com",
  VIX: "https://logo.clearbit.com/cboe.com",
  RUT: "https://logo.clearbit.com/ftserussell.com",
  NDX: "https://logo.clearbit.com/nasdaq.com",
  RUSSELL2000: "https://logo.clearbit.com/ftserussell.com",

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
  TSX: "tsx.com",
  ASX: "asx.com.au",
  XETRA: "deutsche-boerse.com",
  EURONEXT: "euronext.com",
  HKEX: "hkex.com.hk",
  SGX: "sgx.com",
  BINANCE: "binance.com",
  COINBASE: "coinbase.com",
  KRAKEN: "kraken.com",
  BYBIT: "bybit.com",
  OKX: "okx.com",
  GATEIO: "gate.io",
  KUCOIN: "kucoin.com",
  COINGECKO: "coingecko.com",
  // Indian
  MCX: "mcxindia.com",
  NCDEX: "ncdex.com",
  // European
  SWX: "six-group.com",
  MOEX: "moex.com",
  BOLSA: "bmv.com.mx",
  B3: "b3.com.br",
  JSE: "jse.co.za",
  // Other
  AMEX: "nyse.com",
  OTCMARKETS: "otcmarkets.com",
  CFD: "ig.com",
  FOREX: "xe.com",
  FX: "xe.com",
};

/* ── TIER 5 — Generated SVG ────────────────────────────────────────── */

/** Deterministic color from string hash */
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 45%)`;
}

function generateSvgDataUri(symbol: string): string {
  const initials = symbol.slice(0, 2).toUpperCase();
  const color = hashColor(symbol);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="32" fill="${color}"/>
    <text x="32" y="38" text-anchor="middle" fill="white" font-size="22" font-family="Arial,sans-serif" font-weight="bold">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/* ── Main Resolution Function ──────────────────────────────────────── */

export interface LogoResult {
  iconUrl: string;
  logoSource: string;
  logoTier: number;
}

export function resolveLogo(asset: {
  symbol: string;
  type: string;
  exchange?: string;
  companyDomain?: string;
  iconUrl?: string;
  s3Icon?: string;
  name?: string;
}): LogoResult {
  const sym = asset.symbol.toUpperCase();

  // TIER 0: Already has a valid logo (S3 or external URL)
  if (asset.s3Icon && asset.s3Icon.startsWith("http")) {
    return { iconUrl: asset.s3Icon, logoSource: "s3", logoTier: 0 };
  }
  if (asset.iconUrl && asset.iconUrl.startsWith("http") && !asset.iconUrl.includes("default")) {
    return { iconUrl: asset.iconUrl, logoSource: "existing", logoTier: 0 };
  }

  // TIER 1: Symbol map (well-known symbols)
  // Check base symbol (strip USDT/USD suffixes for crypto pairs)
  const baseSymbol = sym.replace(/(USDT|USDC|USD|BUSD|BTC|ETH)$/, "");
  if (SYMBOL_LOGO_MAP[sym]) {
    return { iconUrl: SYMBOL_LOGO_MAP[sym], logoSource: "symbolMap", logoTier: 1 };
  }
  if (baseSymbol && SYMBOL_LOGO_MAP[baseSymbol]) {
    return { iconUrl: SYMBOL_LOGO_MAP[baseSymbol], logoSource: "symbolMap:base", logoTier: 1 };
  }
  // Also try the asset name (e.g. "NIFTY 50", "SENSEX")
  const nameUpper = (asset.name || "").toUpperCase();
  if (nameUpper && SYMBOL_LOGO_MAP[nameUpper]) {
    return { iconUrl: SYMBOL_LOGO_MAP[nameUpper], logoSource: "symbolMap:name", logoTier: 1 };
  }
  // Try symbol with spaces stripped from name
  const nameNoSpace = nameUpper.replace(/\s+/g, "");
  if (nameNoSpace && SYMBOL_LOGO_MAP[nameNoSpace]) {
    return { iconUrl: SYMBOL_LOGO_MAP[nameNoSpace], logoSource: "symbolMap:nameCompact", logoTier: 1 };
  }

  // TIER 2: Type-based resolution
  if (asset.type === "crypto") {
    // Try CoinGecko-style URL for crypto
    const coinId = sym.toLowerCase().replace(/usdt$|usdc$|usd$|busd$|btc$|eth$/i, "");
    if (coinId.length >= 2) {
      return {
        iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${coinId}.org`,
        logoSource: "crypto:favicon",
        logoTier: 2,
      };
    }
  }

  if (asset.type === "forex") {
    // Use the base currency's central bank favicon
    const base = sym.slice(0, 3).toUpperCase();
    if (FOREX_CURRENCY_FLAGS[base]) {
      return { iconUrl: FOREX_CURRENCY_FLAGS[base], logoSource: "forex:flag", logoTier: 2 };
    }
  }

  if (TYPE_FALLBACK_ICONS[asset.type]) {
    return { iconUrl: TYPE_FALLBACK_ICONS[asset.type], logoSource: `type:${asset.type}`, logoTier: 2 };
  }

  // TIER 3: Clearbit domain lookup (explicit domain OR derived from name)
  if (asset.companyDomain) {
    const domain = asset.companyDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return {
      iconUrl: `https://logo.clearbit.com/${domain}`,
      logoSource: "clearbit",
      logoTier: 3,
    };
  }

  // TIER 3b: Derive domain from company name via normalization
  if (asset.name) {
    const derived = deriveDomain(asset.name);
    if (derived) {
      return {
        iconUrl: `https://logo.clearbit.com/${derived}`,
        logoSource: "clearbit:derived",
        logoTier: 3,
      };
    }
  }

  // TIER 4: Google favicon via exchange domain
  const exKey = (asset.exchange || "").toUpperCase();
  const exDomain = EXCHANGE_DOMAIN[exKey];
  if (exDomain) {
    return {
      iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${exDomain}`,
      logoSource: "exchange:favicon",
      logoTier: 4,
    };
  }

  // TIER 4b: Google favicon from derived domain (different from Clearbit)
  if (asset.name) {
    const derived = deriveDomain(asset.name);
    if (derived) {
      return {
        iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${derived}`,
        logoSource: "google:derived",
        logoTier: 4,
      };
    }
  }

  // TIER 5: Generated SVG (guarantees 100% coverage)
  return {
    iconUrl: generateSvgDataUri(sym),
    logoSource: "generated",
    logoTier: 5,
  };
}
