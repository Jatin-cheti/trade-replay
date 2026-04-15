type SymbolType = "stock" | "crypto" | "forex" | "index";
import { env } from "../config/env";
import { resolveStaticIcon } from "../config/staticIconMap";

type ResolveInput = {
  symbol: string;
  name: string;
  exchange: string;
  type: SymbolType;
  companyDomain?: string;
  existingIconUrl?: string;
  existingS3Icon?: string;
};

type ResolveOutput = {
  logoUrl: string | null;
  domain: string | null;
  source: "clearbit" | "google" | "duckduckgo" | "fmp" | "coingecko" | "forex-fallback" | "fund-fallback" | "exchange-fallback" | "none";
  isFallback?: boolean;
};

const CRYPTO_ICON_MAP: Record<string, string> = {
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

const EXCHANGE_FAVICON_MAP: Record<string, string> = {
  NYSE: "https://www.google.com/s2/favicons?domain=nyse.com&sz=128",
  NASDAQ: "https://www.google.com/s2/favicons?domain=nasdaq.com&sz=128",
  NSE: "https://www.google.com/s2/favicons?domain=nseindia.com&sz=128",
  BSE: "https://www.google.com/s2/favicons?domain=bseindia.com&sz=128",
  NYSEARCA: "https://www.google.com/s2/favicons?domain=nyse.com&sz=128",
  BINANCE: "https://www.google.com/s2/favicons?domain=binance.com&sz=128",
  HKEX: "https://www.google.com/s2/favicons?domain=hkex.com.hk&sz=128",
  LSE: "https://www.google.com/s2/favicons?domain=londonstockexchange.com&sz=128",
  XETRA: "https://www.google.com/s2/favicons?domain=deutsche-boerse.com&sz=128",
  EURONEXT: "https://www.google.com/s2/favicons?domain=euronext.com&sz=128",
  RUSSELL: "https://www.google.com/s2/favicons?domain=ftserussell.com&sz=128",
  DJ: "https://www.google.com/s2/favicons?domain=dowjones.com&sz=128",
  FOREX: "https://www.google.com/s2/favicons?domain=xe.com&sz=128",
  GLOBAL: "https://www.google.com/s2/favicons?domain=tradingview.com&sz=128",
};

const DEFAULT_EXCHANGE_ICON = "https://www.google.com/s2/favicons?domain=tradingview.com&sz=128";

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function resolveCdnIcon(input: ResolveInput): string | null {
  const candidates = [input.existingS3Icon, input.existingIconUrl].filter(Boolean) as string[];
  if (!candidates.length) return null;

  const cdnBase = env.AWS_CDN_BASE_URL.trim();
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (cdnBase && candidate.startsWith(cdnBase)) return candidate;
    if (candidate.includes(".amazonaws.com/")) return candidate;
  }

  return null;
}

function googleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function duckduckgoIconUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

function fmpLogoUrl(symbol: string): string {
  return `https://financialmodelingprep.com/image-stock/${symbol.toUpperCase()}.png`;
}

function extractCryptoBase(symbol: string): string {
  const upper = symbol.toUpperCase();
  const suffixes = ["USDT", "USDC", "BUSD", "USD", "INR", "BTC", "ETH", "BNB", "EUR", "TRY"];
  for (const suffix of suffixes) {
    if (upper.endsWith(suffix) && upper.length > suffix.length + 1) {
      return upper.slice(0, -suffix.length);
    }
  }
  return upper;
}

async function validateLogoUrl(url: string): Promise<boolean> {
  if (url.includes("logo.clearbit.com")) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const head = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-service/1.0" },
    });
    if (head.ok) return true;

    const fallback = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "tradereplay-logo-service/1.0",
        Range: "bytes=0-64",
      },
    });

    return fallback.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveByDomain(domain: string): Promise<{ logoUrl: string | null; source: ResolveOutput["source"] }> {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return { logoUrl: null, source: "none" };
  }

  const candidates: Array<{ source: ResolveOutput["source"]; url: string }> = [
    { source: "google", url: googleFaviconUrl(normalized) },
    { source: "duckduckgo", url: duckduckgoIconUrl(normalized) },
  ];

  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await validateLogoUrl(candidate.url)) {
      return { logoUrl: candidate.url, source: candidate.source };
    }
  }

  return { logoUrl: null, source: "none" };
}

async function resolveByDomainMulti(
  token: string,
  exchange: string,
): Promise<{ logoUrl: string | null; domain: string | null; source: ResolveOutput["source"] }> {
  const isIndia = exchange === "NSE" || exchange === "BSE";
  const suffixes = isIndia ? [".com", ".co.in", ".in"] : [".com"];

  for (const suffix of suffixes) {
    const domain = `${token}${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    const result = await resolveByDomain(domain);
    if (result.logoUrl) {
      return { logoUrl: result.logoUrl, domain, source: result.source };
    }
  }

  return { logoUrl: null, domain: null, source: "none" };
}

function inferDomainToken(name: string): string | null {
  const clean = name
    .toLowerCase()
    .replace(
      /\b(limited|ltd|inc\.?|corp\.?|corporation|plc|company|co\.?|holdings|group|enterprises?|industries|international|technologies|technology|solutions|services|finance|financial|pharma|pharmaceutical|chemicals|cement|energy|power|infra|infrastructure|bank|banking)\b/g,
      "",
    )
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const token = clean.split(" ").find((part) => part.length >= 3) || "";
  if (!token) return null;

  return token;
}

async function tryFetchCoinGeckoLogo(symbol: string): Promise<string | null> {
  const base = extractCryptoBase(symbol).toLowerCase();
  if (!base) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(base)}`,
      { method: "GET", signal: controller.signal, headers: { "User-Agent": "tradereplay-logo-service/1.0" } },
    );
    if (!res.ok) return null;

    const payload = (await res.json()) as {
      coins?: Array<{ symbol?: string; large?: string; thumb?: string }>;
    };
    const coins = payload.coins ?? [];
    const exact = coins.find((c) => (c.symbol || "").toLowerCase() === base) ?? coins[0];
    const candidate = exact?.large || exact?.thumb || null;
    if (!candidate) return null;
    if (await validateLogoUrl(candidate)) return candidate;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getExchangeFallback(exchange: string): string {
  return EXCHANGE_FAVICON_MAP[exchange.toUpperCase()] || DEFAULT_EXCHANGE_ICON;
}

export async function resolveLogo(input: ResolveInput): Promise<ResolveOutput> {
  // 1) Static icon map (forex pairs, indices)
  const staticLogo = resolveStaticIcon(input.symbol);
  if (staticLogo) {
    return {
      logoUrl: staticLogo,
      domain: input.type === "forex" ? "xe.com" : null,
      source: input.type === "forex" ? "forex-fallback" : "fund-fallback",
    };
  }

  // 2) Existing CDN icon
  const cdnLogo = resolveCdnIcon(input);
  if (cdnLogo) {
    return {
      logoUrl: cdnLogo,
      domain: input.companyDomain ? normalizeDomain(input.companyDomain) : null,
      source: "fmp",
    };
  }

  // 3) Forex — always resolve with xe.com fallback
  if (input.type === "forex") {
    return {
      logoUrl: "https://www.google.com/s2/favicons?domain=xe.com&sz=128",
      domain: "xe.com",
      source: "forex-fallback",
    };
  }

  // 4) Index — always resolve with deterministic fallback
  if (input.type === "index") {
    const exchangeIcon = EXCHANGE_FAVICON_MAP[input.exchange.toUpperCase()];
    return {
      logoUrl: exchangeIcon || "https://www.google.com/s2/favicons?domain=tradingview.com&sz=128",
      domain: "tradingview.com",
      source: "fund-fallback",
    };
  }

  // 5) Crypto path
  if (input.type === "crypto") {
    const base = extractCryptoBase(input.symbol);
    const mapped = CRYPTO_ICON_MAP[base];
    if (mapped) {
      return { logoUrl: mapped, domain: "coingecko.com", source: "coingecko" };
    }

    // Try CDN icons
    const cdnUrl = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${base.toLowerCase()}.png`;
    if (await validateLogoUrl(cdnUrl)) {
      return { logoUrl: cdnUrl, domain: "github.com", source: "coingecko" };
    }

    // Try CoinGecko search API
    const geckoLogo = await tryFetchCoinGeckoLogo(input.symbol);
    if (geckoLogo) {
      return { logoUrl: geckoLogo, domain: "coingecko.com", source: "coingecko" };
    }

    // Crypto fallback — exchange icon (Binance etc.)
    return {
      logoUrl: getExchangeFallback(input.exchange),
      domain: null,
      source: "exchange-fallback",
      isFallback: true,
    };
  }

  // 6) Stock path — try known domain
  if (input.companyDomain) {
    const byKnownDomain = await resolveByDomain(input.companyDomain);
    if (byKnownDomain.logoUrl) {
      return {
        logoUrl: byKnownDomain.logoUrl,
        domain: normalizeDomain(input.companyDomain),
        source: byKnownDomain.source,
      };
    }
  }

  // 7) Try name-based domain inference
  const token = inferDomainToken(input.name);
  if (token) {
    const byMulti = await resolveByDomainMulti(token, input.exchange);
    if (byMulti.logoUrl) {
      return {
        logoUrl: byMulti.logoUrl,
        domain: byMulti.domain,
        source: byMulti.source,
      };
    }
  }

  // 8) Try FMP stock image
  const fmp = fmpLogoUrl(input.symbol);
  if (await validateLogoUrl(fmp)) {
    return { logoUrl: fmp, domain: token ? `${token}.com` : null, source: "fmp" };
  }

  // 9) FINAL FALLBACK — exchange favicon (NEVER return null)
  return {
    logoUrl: getExchangeFallback(input.exchange),
    domain: null,
    source: "exchange-fallback",
    isFallback: true,
  };
}