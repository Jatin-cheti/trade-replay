import { env } from "../config/env";
import {
  normalizeDomain,
  normalizeSymbol,
  googleFaviconUrl,
  duckduckgoIconUrl,
  clearbitUrl,
  extractCryptoBaseSymbol,
  validateLogoUrl,
  isCircuitOpen,
  markExternalCallFailure,
} from "./logo.helpers";

export async function tryFetchLogo(domain: string): Promise<string | null> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;

  // 1) Google favicon (most reliable)
  const google = googleFaviconUrl(normalized);
  if (await validateLogoUrl(google)) return google;

  // 2) DuckDuckGo host icon
  const duck = duckduckgoIconUrl(normalized);
  if (await validateLogoUrl(duck)) return duck;

  // 3) Clearbit (deprecated, skipped by validator)
  const clearbit = clearbitUrl(normalized);
  if (await validateLogoUrl(clearbit)) return clearbit;

  return null;
}

export async function tryFetchFmpLogo(symbol: string): Promise<string | null> {
  if (!env.FMP_API_KEY) return null;
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) return null;

  const apiKeySuffix = env.FMP_API_KEY ? `?apikey=${encodeURIComponent(env.FMP_API_KEY)}` : "";
  const candidate = `https://financialmodelingprep.com/image-stock/${normalizedSymbol.toUpperCase()}.png${apiKeySuffix}`;
  if (await validateLogoUrl(candidate)) return candidate;
  return null;
}

export async function tryFetchCryptoLogo(symbol: string): Promise<string | null> {
  const base = extractCryptoBaseSymbol(symbol).toLowerCase();
  if (!base) return null;

  const sources = [
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${base}.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/icon/${base}.png`,
  ];

  for (const source of sources) {
    // eslint-disable-next-line no-await-in-loop
    if (await validateLogoUrl(source)) return source;
  }

  return null;
}

export async function tryFetchCoinGeckoLogo(symbol: string): Promise<string | null> {
  if (isCircuitOpen()) return null;

  const base = extractCryptoBaseSymbol(symbol).toLowerCase();
  if (!base) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(base)}`, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-worker/1.0" },
    });
    if (!res.ok) {
      markExternalCallFailure();
      return null;
    }

    const payload = await res.json() as {
      coins?: Array<{ symbol?: string; large?: string; thumb?: string; id?: string }>;
    };

    const coins = payload.coins ?? [];
    const exact = coins.find((coin) => (coin.symbol || "").toLowerCase() === base) ?? coins[0];
    const candidate = exact?.large || exact?.thumb || null;
    if (!candidate) return null;

    if (await validateLogoUrl(candidate)) return candidate;
    markExternalCallFailure();
    return null;
  } catch {
    markExternalCallFailure();
    return null;
  } finally {
    clearTimeout(timeout);
  }
}