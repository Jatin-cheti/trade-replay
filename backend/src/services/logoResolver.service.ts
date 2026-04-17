/**
 * logoResolver.service.ts — Tiered logo resolution for 100% coverage.
 *
 * TIER 1: Hard-coded symbol map (well-known indices, commodities)
 * TIER 2: Type-based resolution (crypto coin icons, forex flags, etc.)
 * TIER 3: Clearbit domain lookup
 * TIER 4: Google favicon fallback
 * TIER 5: Generated initial-based icon (guarantees 100%)
 */

/* ── TIER 1 — Symbol Map ───────────────────────────────────────────── */

const SYMBOL_LOGO_MAP: Record<string, string> = {
  // Major indices
  NIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  NIFTY50: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SENSEX: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/BSE_Logo.svg/120px-BSE_Logo.svg.png",
  BANKNIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SPX: "https://logo.clearbit.com/spglobal.com",
  DJI: "https://logo.clearbit.com/spglobal.com",
  IXIC: "https://logo.clearbit.com/nasdaq.com",
  FTSE: "https://logo.clearbit.com/lseg.com",
  DAX: "https://logo.clearbit.com/deutsche-boerse.com",
  N225: "https://logo.clearbit.com/jpx.co.jp",
  HSI: "https://logo.clearbit.com/hkex.com.hk",

  // Commodities / metals
  XAUUSD: "https://www.google.com/s2/favicons?sz=128&domain=gold.org",
  XAGUSD: "https://www.google.com/s2/favicons?sz=128&domain=silverinstitute.org",
  DXY: "https://www.google.com/s2/favicons?sz=128&domain=ice.com",

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

  // TIER 3: Clearbit domain lookup
  if (asset.companyDomain) {
    const domain = asset.companyDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return {
      iconUrl: `https://logo.clearbit.com/${domain}`,
      logoSource: "clearbit",
      logoTier: 3,
    };
  }

  // TIER 4: Google favicon via exchange domain
  const exDomain = EXCHANGE_DOMAIN[(asset.exchange || "").toUpperCase()];
  if (exDomain) {
    return {
      iconUrl: `https://www.google.com/s2/favicons?sz=128&domain=${exDomain}`,
      logoSource: "exchange:favicon",
      logoTier: 4,
    };
  }

  // TIER 5: Generated SVG (guarantees 100% coverage)
  return {
    iconUrl: generateSvgDataUri(sym),
    logoSource: "generated",
    logoTier: 5,
  };
}
