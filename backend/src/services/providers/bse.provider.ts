import { getHighConfidenceDomain } from "../../config/highConfidenceDomainMap";
import { logger } from "../../utils/logger";
import type { GlobalSymbolCandidate, GlobalSymbolProvider } from "../globalSymbolIngestion.service";
import { SymbolModel } from "../../models/Symbol";

type BseJsonRow = Record<string, unknown>;

const BSE_JSON_SOURCES = [
  "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w",
  "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?strSearch=A",
];
const BSE_HTML_SOURCE = "https://www.bseindia.com/corporates/List_Scrips.html";
const BSE_HEADER_SOURCE = "https://api.bseindia.com/BseIndiaAPI/api/GetScripHeaderData/w";
const DOMAIN_ENRICH_LIMIT = 180;

function normalizeDomain(input: string): string {
  try {
    const parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractDomainFromText(text: string): string {
  const match = text.match(/https?:\/\/(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i);
  return normalizeDomain(match?.[1] || "");
}

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function toCandidate(symbol: string, name: string, scripCode?: string): GlobalSymbolCandidate | null {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedName = normalizeName(name || symbol);
  if (!normalizedSymbol || normalizedSymbol.length < 2 || !normalizedName) return null;

  const trustedDomain = getHighConfidenceDomain(normalizedSymbol) || "";
  return {
    symbol: normalizedSymbol,
    exchange: "BSE",
    name: normalizedName,
    type: "stock",
    country: "IN",
    currency: "INR",
    source: "bse",
    metadata: {
      scripCode: scripCode || "",
      domain: trustedDomain,
      listingSource: "bse-directory",
    },
  };
}

function extractValue(row: BseJsonRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function parseBseJson(payload: unknown): GlobalSymbolCandidate[] {
  const root = payload as { Table?: unknown; Data?: unknown; data?: unknown };
  const candidates = [root?.Table, root?.Data, root?.data, payload].find((entry) => Array.isArray(entry));
  if (!Array.isArray(candidates)) return [];

  const rows: GlobalSymbolCandidate[] = [];
  for (const raw of candidates) {
    const row = raw as BseJsonRow;
    const symbol = extractValue(row, ["Security Id", "securityID", "securityid", "SecurityID", "Symbol", "symbol", "scrip_id"]);
    const name = extractValue(row, ["Security Name", "SecurityName", "securityname", "CompanyName", "companyname", "Name", "name"]);
    const scripCode = extractValue(row, ["Security Code", "SCRIP_CD", "scrip_cd", "scripcode", "ScripCode"]);
    const candidate = toCandidate(symbol, name, scripCode);
    if (candidate) rows.push(candidate);
  }

  return rows;
}

function parseBseHtml(html: string): GlobalSymbolCandidate[] {
  const rows: GlobalSymbolCandidate[] = [];
  const matches = Array.from(html.matchAll(/<tr[^>]*>\s*<td[^>]*>(\d{3,})<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi));
  for (const match of matches) {
    const scripCode = (match[1] || "").trim();
    const symbol = (match[2] || "").trim();
    const name = (match[3] || "").trim();
    const candidate = toCandidate(symbol, name, scripCode);
    if (candidate) rows.push(candidate);
  }
  return rows;
}

async function fetchBseDomain(scripCode: string): Promise<string> {
  const response = await fetch(`${BSE_HEADER_SOURCE}?scripcode=${encodeURIComponent(scripCode)}`, {
    method: "GET",
    headers: {
      "User-Agent": "tradereplay-global-ingestion/1.0",
      Referer: "https://www.bseindia.com/",
      Accept: "application/json,text/plain,*/*",
    },
  });
  if (!response.ok) return "";
  const payload = await response.json();
  return extractDomainFromText(JSON.stringify(payload));
}

async function fetchBseJson(url: string): Promise<GlobalSymbolCandidate[]> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "tradereplay-global-ingestion/1.0",
      Accept: "application/json,text/plain,*/*",
      Referer: "https://www.bseindia.com/",
    },
  });

  if (!response.ok) {
    throw new Error(`BSE source failed: ${response.status}`);
  }

  const payload = await response.json();
  return parseBseJson(payload);
}

async function loadBseFallbackFromDb(): Promise<GlobalSymbolCandidate[]> {
  const rows = await SymbolModel.find({ exchange: "BSE" })
    .sort({ priorityScore: -1, searchFrequency: -1 })
    .select({ symbol: 1, name: 1, companyDomain: 1 })
    .limit(1200)
    .lean<Array<{ symbol: string; name: string; companyDomain?: string }>>();

  return rows
    .map((row) => ({
      symbol: normalizeSymbol(row.symbol),
      exchange: "BSE",
      name: normalizeName(row.name || row.symbol),
      type: "stock",
      country: "IN",
      currency: "INR",
      source: "bse",
      metadata: {
        domain: normalizeDomain(row.companyDomain || ""),
        listingSource: "bse-db-fallback",
      },
    }))
    .filter((row) => row.symbol.length > 1 && row.name.length > 1);
}

export const bseProvider: GlobalSymbolProvider = {
  name: "bse",
  fetchSymbols: async (): Promise<GlobalSymbolCandidate[]> => {
    for (const source of BSE_JSON_SOURCES) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const rows = await fetchBseJson(source);
        if (rows.length > 0) {
          for (let i = 0; i < rows.length && i < DOMAIN_ENRICH_LIMIT; i += 1) {
            const row = rows[i];
            const scripCode = String(row.metadata?.scripCode || "").trim();
            const preDomain = typeof row.metadata?.domain === "string" ? row.metadata.domain : "";
            if (!row || !scripCode || preDomain) continue;
            try {
              // eslint-disable-next-line no-await-in-loop
              const domain = await fetchBseDomain(scripCode);
              if (!domain) continue;
              row.metadata = { ...(row.metadata || {}), domain };
            } catch {
              // best effort enrichment
            }
          }

          logger.info("bse_provider_fetch_success", { provider: "bse", source, symbols: rows.length });
          return rows;
        }
      } catch (error) {
        logger.warn("bse_provider_fetch_failed", {
          provider: "bse",
          source,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      const response = await fetch(BSE_HTML_SOURCE, {
        method: "GET",
        headers: {
          "User-Agent": "tradereplay-global-ingestion/1.0",
          Accept: "text/html,*/*",
          Referer: "https://www.bseindia.com/",
        },
      });
      if (response.ok) {
        const html = await response.text();
        const rows = parseBseHtml(html);
        if (rows.length > 0) {
          logger.info("bse_provider_fetch_success", { provider: "bse", source: BSE_HTML_SOURCE, symbols: rows.length });
          return rows;
        }
      }
    } catch (error) {
      logger.warn("bse_provider_fetch_failed", {
        provider: "bse",
        source: BSE_HTML_SOURCE,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const fallbackRows = await loadBseFallbackFromDb();
    if (fallbackRows.length > 0) {
      logger.info("bse_provider_fetch_success", {
        provider: "bse",
        source: "db-fallback",
        symbols: fallbackRows.length,
      });
      return fallbackRows;
    }

    logger.warn("bse_provider_empty", { provider: "bse" });
    return [];
  },
};
