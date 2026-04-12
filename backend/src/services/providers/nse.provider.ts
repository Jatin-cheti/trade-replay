import { getHighConfidenceDomain } from "../../config/highConfidenceDomainMap";
import { logger } from "../../utils/logger";
import type { GlobalSymbolCandidate, GlobalSymbolProvider } from "../globalSymbolIngestion.service";

const NSE_SOURCES = [
  "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
  "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
];
const DOMAIN_ENRICH_LIMIT = 220;

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

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  values.push(current.trim());
  return values;
}

function toCandidate(symbol: string, name: string): GlobalSymbolCandidate | null {
  const normalizedSymbol = symbol.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  const normalizedName = name.trim();
  if (!normalizedSymbol || normalizedSymbol.length < 2 || !normalizedName) return null;

  const trustedDomain = getHighConfidenceDomain(normalizedSymbol) || "";
  return {
    symbol: normalizedSymbol,
    exchange: "NSE",
    name: normalizedName,
    type: "stock",
    country: "IN",
    currency: "INR",
    source: "nse",
    metadata: {
      domain: trustedDomain,
      market: "equity",
      listingSource: "nse-official-listing",
    },
  };
}

async function fetchNseDomain(symbol: string): Promise<string> {
  const response = await fetch(`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`, {
    method: "GET",
    headers: {
      "User-Agent": "tradereplay-global-ingestion/1.0",
      Referer: "https://www.nseindia.com/",
      Accept: "application/json,text/plain,*/*",
    },
  });
  if (!response.ok) return "";

  const payload = await response.json();
  return extractDomainFromText(JSON.stringify(payload));
}

async function fetchNseCsv(url: string): Promise<GlobalSymbolCandidate[]> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "tradereplay-global-ingestion/1.0",
      Accept: "text/csv,text/plain,*/*",
      Referer: "https://www.nseindia.com/",
    },
  });

  if (!response.ok) {
    throw new Error(`NSE source failed: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const header = parseCsvRow(lines[0] || "").map((h) => h.toUpperCase());
  const symbolIndex = header.findIndex((h) => h === "SYMBOL");
  const nameIndex = header.findIndex((h) => h.includes("NAME"));
  if (symbolIndex < 0 || nameIndex < 0) return [];

  const candidates: GlobalSymbolCandidate[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvRow(lines[i] || "");
    const symbol = row[symbolIndex] || "";
    const name = row[nameIndex] || symbol;
    const candidate = toCandidate(symbol, name);
    if (candidate) candidates.push(candidate);
  }

  return candidates;
}

export const nseProvider: GlobalSymbolProvider = {
  name: "nse",
  fetchSymbols: async (): Promise<GlobalSymbolCandidate[]> => {
    for (const source of NSE_SOURCES) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const rows = await fetchNseCsv(source);
        if (rows.length > 0) {
          for (let i = 0; i < rows.length && i < DOMAIN_ENRICH_LIMIT; i += 1) {
            const row = rows[i];
            if (!row) continue;
            const preDomain = typeof row.metadata?.domain === "string" ? row.metadata.domain : "";
            if (preDomain) continue;
            try {
              // eslint-disable-next-line no-await-in-loop
              const domain = await fetchNseDomain(row.symbol);
              if (!domain) continue;
              row.metadata = { ...(row.metadata || {}), domain };
            } catch {
              // best effort enrichment
            }
          }

          logger.info("nse_provider_fetch_success", { provider: "nse", source, symbols: rows.length });
          return rows;
        }
      } catch (error) {
        logger.warn("nse_provider_fetch_failed", {
          provider: "nse",
          source,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.warn("nse_provider_empty", { provider: "nse" });
    return [];
  },
};
