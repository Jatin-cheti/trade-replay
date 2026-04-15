import { env } from "../config/env";
import { getHighConfidenceDomain } from "../config/highConfidenceDomainMap";
import { SymbolModel } from "../models/Symbol";

export type DomainSource = "high-confidence-map" | "wikipedia" | "google-search" | "nse-profile" | "bse-profile" | "fmp-optional";

export interface DomainResolutionResult {
  domain: string | null;
  source: DomainSource | null;
  confidence: number;
  httpErrors: number;
}

const BLACKLIST = new Set(["tgroup.com", "agroup.com", "holdingcompany.com"]);

const DIRECTORY_DOMAINS = new Set([
  "wikipedia.org",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "bloomberg.com",
  "moneycontrol.com",
  "investing.com",
  "screener.in",
  "nseindia.com",
  "bseindia.com",
]);

function normalizeDomain(input: string): string | null {
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|inc\.?|corp\.?|corporation|plc|company|co\.?)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function domainSimilarity(domain: string, companyName: string): number {
  const root = (domain.split(".")[0] || "").toLowerCase();
  if (!root) return 0;
  const tokens = normalizeCompanyName(companyName).split(" ").filter((token) => token.length >= 3);
  if (!tokens.length) return 0;
  const joined = tokens.join("");
  if (joined.includes(root) || root.includes(joined)) return 1;
  const overlaps = tokens.filter((token) => root.includes(token) || token.includes(root));
  return overlaps.length / tokens.length;
}

function isGenericDomain(domain: string): boolean {
  const root = domain.split(".")[0] || "";
  const genericRoots = ["group", "global", "holding", "holdings", "service", "services"];
  return !root || root.length <= 1 || genericRoots.some((token) => root.includes(token));
}

async function isReusedAcrossCompanies(domain: string, symbol: string, companyName: string): Promise<boolean> {
  const rows = await SymbolModel.find({
    companyDomain: domain,
    symbol: { $ne: symbol.toUpperCase() },
  })
    .select({ name: 1 })
    .limit(5)
    .lean<Array<{ name: string }>>();

  const normalizedName = normalizeCompanyName(companyName);
  return rows.some((row) => normalizeCompanyName(row.name) !== normalizedName);
}

export async function isValidDomainForCompany(
  domain: string | null,
  companyName: string,
  symbol: string,
  minSimilarity = 0.6,
  skipReuseCheck = false,
): Promise<boolean> {
  if (!domain) return false;
  const normalized = normalizeDomain(domain);
  if (!normalized) return false;
  if (BLACKLIST.has(normalized)) return false;
  if (isGenericDomain(normalized)) return false;
  if (domainSimilarity(normalized, companyName) < minSimilarity) return false;
  if (!skipReuseCheck && await isReusedAcrossCompanies(normalized, symbol, companyName)) return false;
  return true;
}

async function fetchText(url: string, timeoutMs = 3500): Promise<{ ok: boolean; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "tradereplay-domain-intelligence/1.0 contact=admin@tradereplay.local",
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
    });
    const text = await res.text();
    return { ok: res.ok, text };
  } catch {
    return { ok: false, text: "" };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url: string, timeoutMs = 4000): Promise<{ ok: boolean; payload: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "tradereplay-domain-intelligence/1.0 contact=admin@tradereplay.local",
        Accept: "application/json,text/plain,*/*",
      },
    });

    if (!res.ok) return { ok: false, payload: null };
    return { ok: true, payload: await res.json() };
  } catch {
    return { ok: false, payload: null };
  } finally {
    clearTimeout(timeout);
  }
}

function extractDomainFromText(text: string): string | null {
  const match = text.match(/https?:\/\/(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i);
  return match?.[1] ? normalizeDomain(match[1]) : null;
}

function extractDomainFromJsonWebsiteKeys(payload: unknown): string | null {
  const text = JSON.stringify(payload);
  const directKeys = ["website", "Website", "investorWebsite", "homepage", "url"];

  for (const key of directKeys) {
    const regex = new RegExp(`\\"${key}\\"\\s*:\\s*\\"([^\\\"]+)\\"`, "i");
    const match = text.match(regex);
    if (!match?.[1]) continue;
    const domain = normalizeDomain(match[1]);
    if (domain) return domain;
  }

  return extractDomainFromText(text);
}

function extractWikipediaWebsite(html: string): string | null {
  const infobox = html.match(/<table[^>]*class="[^"]*infobox[^"]*"[\s\S]*?<\/table>/i)?.[0] || html;
  const websiteRow = infobox.match(/<th[^>]*>\s*Website\s*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] || "";
  const direct = websiteRow.match(/href="([^"]+)"/i)?.[1] || "";
  const candidate = direct || websiteRow;
  if (!candidate) return null;
  const normalized = normalizeDomain(candidate);
  if (normalized) return normalized;
  return extractDomainFromText(candidate);
}

function extractGoogleFirstResultDomain(html: string): string | null {
  const results = Array.from(html.matchAll(/href="\/url\?q=([^"&]+)[^"]*"/g));
  for (const item of results) {
    const url = decodeURIComponent(item[1] || "");
    const domain = normalizeDomain(url);
    if (!domain) continue;
    if (DIRECTORY_DOMAINS.has(domain)) continue;
    return domain;
  }
  return null;
}

let secTickerCache: Map<string, string> | null = null;

async function resolveSecCik(symbol: string): Promise<string | null> {
  if (!secTickerCache) {
    const secTickers = await fetchJson("https://www.sec.gov/files/company_tickers.json", 5000);
    if (!secTickers.ok || !secTickers.payload) return null;

    const map = new Map<string, string>();
    const payload = secTickers.payload as Record<string, { ticker?: string; cik_str?: number }>;
    for (const row of Object.values(payload)) {
      if (!row?.ticker || !row?.cik_str) continue;
      map.set(row.ticker.toUpperCase(), String(row.cik_str).padStart(10, "0"));
    }
    secTickerCache = map;
  }

  return secTickerCache.get(symbol.toUpperCase()) || null;
}

async function fetchFromWikipedia(companyName: string): Promise<{ domain: string | null; httpError: boolean }> {
  const slug = encodeURIComponent(companyName.trim().replace(/\s+/g, "_"));
  const direct = await fetchText(`https://en.wikipedia.org/wiki/${slug}`);
  if (direct.ok) {
    return { domain: extractWikipediaWebsite(direct.text), httpError: false };
  }

  const search = await fetchText(`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(companyName)}`);
  if (!search.ok) return { domain: null, httpError: true };
  return { domain: extractWikipediaWebsite(search.text), httpError: false };
}

async function fetchFromWikidataWebsite(symbol: string, companyName: string): Promise<{ domain: string | null; httpError: boolean }> {
  const query = `SELECT ?website WHERE {
    {
      ?item wdt:P249 \"${symbol.toUpperCase()}\" .
      OPTIONAL { ?item wdt:P856 ?website . }
    }
    UNION
    {
      ?item rdfs:label ?label FILTER (lang(?label) = \"en\") .
      FILTER(CONTAINS(LCASE(STR(?label)), LCASE(\"${companyName}\")))
      OPTIONAL { ?item wdt:P856 ?website . }
    }
  } LIMIT 5`;

  const response = await fetchJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, 5000);
  if (!response.ok) return { domain: null, httpError: true };

  const payload = response.payload as {
    results?: {
      bindings?: Array<{ website?: { value?: string } }>;
    };
  };

  const websites = payload.results?.bindings ?? [];
  for (const row of websites) {
    const domain = normalizeDomain(row.website?.value || "");
    if (domain) return { domain, httpError: false };
  }

  return { domain: null, httpError: false };
}

async function fetchFromSecEdgar(symbol: string): Promise<{ domain: string | null; httpError: boolean }> {
  const cik = await resolveSecCik(symbol);
  if (!cik) return { domain: null, httpError: false };

  const submissions = await fetchJson(`https://data.sec.gov/submissions/CIK${cik}.json`, 5000);
  if (!submissions.ok) return { domain: null, httpError: true };

  const domain = extractDomainFromJsonWebsiteKeys(submissions.payload);
  return { domain, httpError: false };
}

async function fetchFromGoogle(companyName: string): Promise<{ domain: string | null; httpError: boolean }> {
  const query = `${companyName} official website`;
  const response = await fetchText(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=en`);
  if (!response.ok) return { domain: null, httpError: true };
  return { domain: extractGoogleFirstResultDomain(response.text), httpError: false };
}

async function fetchFromNse(symbol: string): Promise<{ domain: string | null; httpError: boolean }> {
  const upper = symbol.toUpperCase();
  const quote = await fetchJson(`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(upper)}`);
  if (quote.ok) {
    const domain = extractDomainFromJsonWebsiteKeys(quote.payload);
    if (domain) return { domain, httpError: false };
  }

  const response = await fetchText(`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(upper)}`);
  if (!response.ok) return { domain: null, httpError: true };
  return { domain: extractDomainFromText(response.text), httpError: false };
}

async function fetchFromBse(symbol: string): Promise<{ domain: string | null; httpError: boolean }> {
  const upper = symbol.toUpperCase();
  const api = await fetchJson("https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w");
  if (api.ok) {
    const domain = extractDomainFromJsonWebsiteKeys(api.payload);
    if (domain) return { domain, httpError: false };
  }

  const response = await fetchText(`https://www.bseindia.com/stock-share-price/${encodeURIComponent(upper)}/`);
  if (!response.ok) return { domain: null, httpError: true };
  return { domain: extractDomainFromText(response.text), httpError: false };
}

async function fetchFromFmpOptional(symbol: string): Promise<{ domain: string | null; httpError: boolean }> {
  if (!env.FMP_API_KEY) return { domain: null, httpError: false };
  const response = await fetchText(`https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbol.toUpperCase())}?apikey=${encodeURIComponent(env.FMP_API_KEY)}`);
  if (!response.ok) return { domain: null, httpError: true };

  try {
    const payload = JSON.parse(response.text) as Array<{ website?: string }>;
    return { domain: normalizeDomain(payload[0]?.website || ""), httpError: false };
  } catch {
    return { domain: null, httpError: false };
  }
}

export async function resolveTrustedDomainMultiSource(input: {
  symbol: string;
  companyName: string;
  exchange?: string;
}): Promise<DomainResolutionResult> {
  let httpErrors = 0;
  let confidenceSignal = 0;

  const highConfidenceDomain = getHighConfidenceDomain(input.symbol);
  if (await isValidDomainForCompany(highConfidenceDomain, input.companyName, input.symbol, 0.45, true)) {
    return { domain: highConfidenceDomain, source: "high-confidence-map", confidence: 0.995, httpErrors };
  }

  const wiki = await fetchFromWikipedia(input.companyName);
  if (wiki.httpError) httpErrors += 1;
  if (wiki.domain) confidenceSignal = Math.max(confidenceSignal, 0.62);
  if (await isValidDomainForCompany(wiki.domain, input.companyName, input.symbol, 0.25, true)) {
    return { domain: wiki.domain, source: "wikipedia", confidence: 0.9, httpErrors };
  }

  const wikidata = await fetchFromWikidataWebsite(input.symbol, input.companyName);
  if (wikidata.httpError) httpErrors += 1;
  if (wikidata.domain) confidenceSignal = Math.max(confidenceSignal, 0.66);
  if (await isValidDomainForCompany(wikidata.domain, input.companyName, input.symbol, 0.25, true)) {
    return { domain: wikidata.domain, source: "wikipedia", confidence: 0.86, httpErrors };
  }

  const sec = await fetchFromSecEdgar(input.symbol);
  if (sec.httpError) httpErrors += 1;
  if (sec.domain) confidenceSignal = Math.max(confidenceSignal, 0.67);
  if (sec.domain && !BLACKLIST.has(sec.domain) && !DIRECTORY_DOMAINS.has(sec.domain)) {
    return { domain: sec.domain, source: "fmp-optional", confidence: 0.85, httpErrors };
  }

  const upperExchange = (input.exchange || "").toUpperCase();

  if (upperExchange === "NSE") {
    const nse = await fetchFromNse(input.symbol);
    if (nse.httpError) httpErrors += 1;
    if (nse.domain) confidenceSignal = Math.max(confidenceSignal, 0.64);
    if (await isValidDomainForCompany(nse.domain, input.companyName, input.symbol, 0.5)) {
      return { domain: nse.domain, source: "nse-profile", confidence: 0.78, httpErrors };
    }
  }

  if (upperExchange === "BSE") {
    const bse = await fetchFromBse(input.symbol);
    if (bse.httpError) httpErrors += 1;
    if (bse.domain) confidenceSignal = Math.max(confidenceSignal, 0.64);
    if (await isValidDomainForCompany(bse.domain, input.companyName, input.symbol, 0.5)) {
      return { domain: bse.domain, source: "bse-profile", confidence: 0.78, httpErrors };
    }
  }

  if (confidenceSignal > 0.3 || httpErrors < 2) {
    const google = await fetchFromGoogle(input.companyName);
    if (google.httpError) httpErrors += 1;
    if (await isValidDomainForCompany(google.domain, input.companyName, input.symbol, 0.3, true)) {
      return { domain: google.domain, source: "google-search", confidence: 0.82, httpErrors };
    }
  }

  const fmp = await fetchFromFmpOptional(input.symbol);
  if (fmp.httpError) httpErrors += 1;
  if (await isValidDomainForCompany(fmp.domain, input.companyName, input.symbol, 0.5)) {
    return { domain: fmp.domain, source: "fmp-optional", confidence: 0.72, httpErrors };
  }

  return { domain: null, source: null, confidence: 0, httpErrors };
}
