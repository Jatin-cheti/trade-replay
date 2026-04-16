import { FailureReason } from "./diagnostics.service";

// ── URL builders ─────────────────────────────────────────────────────────

export function clearbitUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

export function googleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

export function duckduckgoIconUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

// ── Normalizers ───────────────────────────────────────────────────────────

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

// ── Circuit breaker ───────────────────────────────────────────────────────

const failedDomains = new Set<string>();
const validDomains = new Set<string>();
export const CIRCUIT_BREAKER_THRESHOLD = 50;
export const CIRCUIT_BREAKER_COOLDOWN_MS = 90 * 1000;
let externalFailureCount = 0;
let circuitOpenUntil = 0;

export const CRYPTO_ICON_MAP: Record<string, string> = {
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

export function extractBaseSymbol(rawSymbol: string): string {
  const upper = rawSymbol.trim().toUpperCase();
  const [head] = upper.split(/[-.$]/);
  return head || upper;
}

export function extractCryptoBaseSymbol(rawSymbol: string): string {
  const upper = normalizeSymbol(rawSymbol);
  const quoteSuffixes = ["USDT", "USDC", "BUSD", "USD", "INR", "BTC", "ETH", "BNB", "EUR", "TRY"];
  for (const suffix of quoteSuffixes) {
    if (upper.endsWith(suffix) && upper.length > suffix.length + 1) {
      return upper.slice(0, -suffix.length);
    }
  }
  return upper;
}

export function getLogoUrlDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();

    if (host.includes("google.com") || host.includes("duckduckgo.com")) {
      const queryDomain = parsed.searchParams.get("domain");
      if (queryDomain) return normalizeDomain(queryDomain);
      if (parsed.pathname.startsWith("/ip3/")) {
        const match = parsed.pathname.match(/^\/ip3\/([^/.]+\.[^/.]+)\.?/i);
        if (match?.[1]) return normalizeDomain(match[1]);
      }
    }

    if (host.includes("logo.clearbit.com")) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length > 0) return normalizeDomain(segments[0]);
    }

    return normalizeDomain(host);
  } catch {
    return null;
  }
}

export function getLogoSourceFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();
    if (host.includes("clearbit.com")) return "clearbit";
    if (host.includes("google.com")) return "google";
    if (host.includes("duckduckgo.com")) return "duckduckgo";
    if (host.includes("financialmodelingprep.com")) return "fmp";
    if (host.includes("coingecko.com")) return "coingecko";
    if (host.includes("jsdelivr.net")) return "crypto-static";
    if (host.includes("assets.coingecko.com")) return "coingecko";
    return host;
  } catch {
    return "unknown";
  }
}

const GENERIC_LOGO_PATTERNS = [
  /exchange/i,
  /default/i,
  /generated/i,
  /\/icons\/exchange\//i,
  /\/icons\/category\//i,
  /\/icons\/sector\//i,
];

export function isGenericLogoUrl(url?: string | null): boolean {
  if (!url) return true;
  const normalized = url.toLowerCase();
  return GENERIC_LOGO_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isBlockedGuessedDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain);
  const blockedRoots = new Set(["usdt", "usdc", "busd", "usd", "inr", "btc", "eth", "bnb"]);
  const root = normalized.split(".")[0] || "";
  return blockedRoots.has(root);
}

export function isPlausibleGuessedDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain);
  if (!normalized || !normalized.includes(".")) return false;
  if (isBlockedGuessedDomain(normalized)) return false;
  const root = normalized.split(".")[0] || "";
  if (root.length < 3) return false;
  return /^[a-z0-9][a-z0-9-]*\.[a-z0-9.-]+$/.test(normalized);
}

const GENERIC_LOW_CONFIDENCE_TOKENS = new Set([
  "india", "indian", "global", "group", "holding", "holdings", "service", "services",
  "solution", "solutions", "system", "systems", "enterprise", "enterprises",
  "industry", "industries", "financial", "finance", "capital", "investment",
  "investments", "ventures", "infra", "energy", "auto", "motors", "technology", "technologies",
]);

export function pickLowConfidenceToken(symbol: string, name: string, country?: string): string {
  const base = extractBaseSymbol(symbol).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (base.length >= 4 && !GENERIC_LOW_CONFIDENCE_TOKENS.has(base)) {
    return base;
  }

  const isIndia = (country || "").toUpperCase() === "IN" || (country || "").toUpperCase() === "INDIA";
  const cleanedNameTokens = name
    .toLowerCase()
    .replace(/\b(limited|ltd|inc\.?|corp\.?|plc|company|co\.?|holdings|group)\b/gi, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((part) => part.length >= 4 && !GENERIC_LOW_CONFIDENCE_TOKENS.has(part));

  if (!cleanedNameTokens.length) return "";
  if (!isIndia) return cleanedNameTokens[0] ?? "";
  return cleanedNameTokens.sort((a, b) => b.length - a.length)[0] ?? "";
}

export function generateLowConfidenceDomainGuesses(input: { symbol: string; name: string; country?: string }): string[] {
  const token = pickLowConfidenceToken(input.symbol, input.name, input.country);
  if (!token) return [];
  const isIndia = (input.country || "").toUpperCase() === "IN" || (input.country || "").toUpperCase() === "INDIA";
  const tlds = isIndia ? [".com", ".co.in", ".in"] : [".com", ".io", ".org"];
  return tlds.map((tld) => `${token}${tld}`);
}

export function etfFallbackLogoUrl(): string {
  return "https://www.google.com/s2/favicons?domain=etf.com&sz=128";
}

export function forexFallbackLogoUrl(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  return `https://www.google.com/s2/favicons?domain=xe.com&sz=128&pair=${normalized}`;
}

export function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

export function markExternalCallSuccess(): void {
  externalFailureCount = 0;
}

export function markExternalCallFailure(): void {
  externalFailureCount += 1;
  if (externalFailureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
  }
}

// ── Validation ────────────────────────────────────────────────────────────

export async function validateLogoUrl(url: string): Promise<boolean> {
  if (isCircuitOpen()) return false;
  if (url.includes("logo.clearbit.com")) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-worker/1.0" },
    });
    if (response.ok) return true;

    const fallback = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-worker/1.0", Range: "bytes=0-64" },
    });
    if (fallback.ok) {
      markExternalCallSuccess();
      return true;
    }
    markExternalCallFailure();
    return false;
  } catch {
    markExternalCallFailure();
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateLogoUrlDetailed(url: string): Promise<{ ok: boolean; failureReason?: FailureReason }> {
  if (isCircuitOpen()) {
    return { ok: false, failureReason: FailureReason.RATE_LIMIT };
  }
  if (url.includes("logo.clearbit.com")) {
    return { ok: false, failureReason: FailureReason.API_404 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-worker/1.0" },
    });
    if (response.ok) {
      markExternalCallSuccess();
      return { ok: true };
    }
    if (response.status === 404) return { ok: false, failureReason: FailureReason.API_404 };
    if (response.status === 429) return { ok: false, failureReason: FailureReason.RATE_LIMIT };

    const fallback = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-worker/1.0", Range: "bytes=0-64" },
    });
    if (fallback.ok) {
      markExternalCallSuccess();
      return { ok: true };
    }
    if (fallback.status === 404) return { ok: false, failureReason: FailureReason.API_404 };
    if (fallback.status === 429) return { ok: false, failureReason: FailureReason.RATE_LIMIT };
    markExternalCallFailure();
    return { ok: false, failureReason: FailureReason.INVALID_LOGO };
  } catch {
    markExternalCallFailure();
    return { ok: false, failureReason: FailureReason.INVALID_LOGO };
  } finally {
    clearTimeout(timeout);
  }
}

export async function isValidDomain(domain: string): Promise<boolean> {
  if (isCircuitOpen()) return false;

  const normalized = normalizeDomain(domain);
  if (!normalized || failedDomains.has(normalized)) return false;
  if (validDomains.has(normalized)) return true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`https://${normalized}`, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-domain-check/1.0" },
    });
    if (res.ok) {
      validDomains.add(normalized);
      markExternalCallSuccess();
      return true;
    }

    const fallback = await fetch(`https://${normalized}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "tradereplay-domain-check/1.0",
        Range: "bytes=0-64",
      },
    });

    if (fallback.ok || (fallback.status >= 300 && fallback.status < 500 && fallback.status !== 404)) {
      validDomains.add(normalized);
      markExternalCallSuccess();
      return true;
    }

    failedDomains.add(normalized);
    markExternalCallFailure();
    return false;
  } catch {
    failedDomains.add(normalized);
    markExternalCallFailure();
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getValidatedDomain(domain: string | null | undefined): Promise<string | null> {
  if (!domain) return null;
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;
  if (!(await isValidDomain(normalized))) return null;
  return normalized;
}