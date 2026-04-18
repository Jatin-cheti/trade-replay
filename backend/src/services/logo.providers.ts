import { env } from "../config/env";
import { getFmpKey } from "./apiKeyManager.service";
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

type LogoSourceAttempt = {
  source: string;
  logoUrl: string;
};

function brandfetchUrl(domain: string): string {
  return `https://api.brandfetch.io/v2/brands/${encodeURIComponent(domain)}`;
}

function thesvgSearchUrl(companyName: string): string {
  return `https://thesvg.com/search?q=${encodeURIComponent(companyName)}`;
}

function flaticonSearchUrl(companyName: string): string {
  return `https://www.flaticon.com/search?word=${encodeURIComponent(companyName)}%20logo`;
}

function domainTokenMatch(companyName: string, value: string): boolean {
  const tokens = companyName
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  const normalized = value.toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function parseFirstUrlFromHtml(html: string): string | null {
  const srcMatch = html.match(/(?:src|href)=["'](https?:\/\/[^"']+)["']/i);
  return srcMatch?.[1] || null;
}

function parseOgImage(html: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch?.[1]?.startsWith("http")) return ogMatch[1];
  const altOgMatch = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (altOgMatch?.[1]?.startsWith("http")) return altOgMatch[1];
  return null;
}

function parseTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1]?.trim() || "";
}

export async function tryFetchLogo(domain: string): Promise<string | null> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;

  const clearbit = clearbitUrl(normalized);
  if (await validateLogoUrl(clearbit)) return clearbit;

  const google = googleFaviconUrl(normalized);
  if (await validateLogoUrl(google)) return google;

  const duck = duckduckgoIconUrl(normalized);
  if (await validateLogoUrl(duck)) return duck;

  return null;
}

export async function tryFetchClearbitLogo(domain: string): Promise<string | null> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;
  const url = clearbitUrl(normalized);
  return (await validateLogoUrl(url)) ? url : null;
}

export async function tryFetchBrandfetchLogo(domain: string): Promise<string | null> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;

  const apiKey = (process.env.BRANDFETCH_API_KEY || "").trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const headers: Record<string, string> = {
      "User-Agent": "tradereplay-logo-worker/1.0",
      Accept: "application/json",
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch(brandfetchUrl(normalized), {
      method: "GET",
      signal: controller.signal,
      headers,
    });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
        markExternalCallFailure();
      }
      return null;
    }

    const payload = await res.json() as {
      logos?: Array<{ formats?: Array<{ src?: string; format?: string }> }>;
      icon?: string;
    };

    const candidates: string[] = [];
    if (payload.icon) candidates.push(payload.icon);
    for (const logo of payload.logos || []) {
      for (const format of logo.formats || []) {
        if (format.src) candidates.push(format.src);
      }
    }

    for (const candidate of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (candidate.startsWith("http") && await validateLogoUrl(candidate)) {
        return candidate;
      }
    }

    return null;
  } catch {
    markExternalCallFailure();
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function tryFetchTheSvgLogo(companyName: string): Promise<string | null> {
  const q = companyName.trim();
  if (!q) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(thesvgSearchUrl(q), {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-worker/1.0" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const src = parseFirstUrlFromHtml(html);
    if (src && await validateLogoUrl(src)) return src;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function tryFetchFlaticonLogo(companyName: string): Promise<string | null> {
  const q = companyName.trim();
  if (!q) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(flaticonSearchUrl(q), {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-worker/1.0" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const src = parseFirstUrlFromHtml(html);
    if (src && await validateLogoUrl(src)) return src;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function tryFetchAiWebSearchLogo(companyName: string, domain?: string): Promise<string | null> {
  const query = `${companyName} official logo SVG PNG`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(ddgUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-worker/1.0" },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const firstUrl = parseFirstUrlFromHtml(html);
    if (firstUrl && await validateLogoUrl(firstUrl)) return firstUrl;

    if (domain) {
      const google = googleFaviconUrl(normalizeDomain(domain));
      if (await validateLogoUrl(google)) return google;
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function tryFetchDirectWebScrapeLogo(domain: string, companyName: string): Promise<string | null> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://${normalized}`, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-worker/1.0" },
      redirect: "follow",
    });
    if (!res.ok) return null;

    const html = await res.text();
    const pageTitle = parseTitle(html);
    if (pageTitle && !domainTokenMatch(companyName, pageTitle)) {
      return null;
    }

    const ogImage = parseOgImage(html);
    if (ogImage && await validateLogoUrl(ogImage)) return ogImage;

    const faviconMatch = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
      || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i);

    if (faviconMatch?.[1]) {
      const href = faviconMatch[1];
      const absolute = href.startsWith("http") ? href : `https://${normalized}${href.startsWith("/") ? "" : "/"}${href}`;
      if (await validateLogoUrl(absolute)) return absolute;
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function tryOrderedLogoSources(domain: string, companyName: string): Promise<LogoSourceAttempt | null> {
  const ordered = [
    async (): Promise<LogoSourceAttempt | null> => {
      const logo = await tryFetchClearbitLogo(domain);
      return logo ? { source: "clearbit", logoUrl: logo } : null;
    },
    async (): Promise<LogoSourceAttempt | null> => {
      const logo = await tryFetchBrandfetchLogo(domain);
      return logo ? { source: "brandfetch", logoUrl: logo } : null;
    },
    async (): Promise<LogoSourceAttempt | null> => {
      const logo = await tryFetchTheSvgLogo(companyName);
      return logo ? { source: "thesvg", logoUrl: logo } : null;
    },
    async (): Promise<LogoSourceAttempt | null> => {
      const logo = await tryFetchFlaticonLogo(companyName);
      return logo ? { source: "flaticon", logoUrl: logo } : null;
    },
    async (): Promise<LogoSourceAttempt | null> => {
      const logo = await tryFetchAiWebSearchLogo(companyName, domain);
      return logo ? { source: "ai-web-search", logoUrl: logo } : null;
    },
    async (): Promise<LogoSourceAttempt | null> => {
      const logo = await tryFetchDirectWebScrapeLogo(domain, companyName);
      return logo ? { source: "direct-web-scrape", logoUrl: logo } : null;
    },
  ];

  for (const fn of ordered) {
    // eslint-disable-next-line no-await-in-loop
    const found = await fn();
    if (found) return found;
  }

  return null;
}

export async function tryFetchFmpLogo(symbol: string): Promise<string | null> {
  const fmpKey = getFmpKey();
  if (!fmpKey) return null;
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) return null;

  const apiKeySuffix = `?apikey=${encodeURIComponent(fmpKey)}`;
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