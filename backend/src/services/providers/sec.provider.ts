import { logger } from "../../utils/logger";
import type { GlobalSymbolCandidate, GlobalSymbolProvider } from "../globalSymbolIngestion.service";

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const DOMAIN_ENRICH_LIMIT = 220;

function normalizeDomain(input: string): string {
  try {
    const parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractWebsiteFromJson(payload: unknown): string {
  const text = JSON.stringify(payload);
  const match = text.match(/\"website\"\s*:\s*\"([^\"]+)\"/i);
  return match?.[1] || "";
}

async function fetchSecDomain(cik: number): Promise<string> {
  const normalizedCik = String(cik).padStart(10, "0");
  const response = await fetch(`https://data.sec.gov/submissions/CIK${normalizedCik}.json`, {
    method: "GET",
    headers: {
      "User-Agent": "tradereplay-global-ingestion/1.0 contact=admin@tradereplay.local",
      Accept: "application/json",
    },
  });
  if (!response.ok) return "";
  const payload = await response.json();
  return normalizeDomain(extractWebsiteFromJson(payload));
}

export const secProvider: GlobalSymbolProvider = {
  name: "sec",
  fetchSymbols: async (): Promise<GlobalSymbolCandidate[]> => {
    try {
      const response = await fetch(SEC_TICKERS_URL, {
        method: "GET",
        headers: {
          "User-Agent": "tradereplay-global-ingestion/1.0 contact=admin@tradereplay.local",
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        logger.warn("sec_fetch_failed", { status: response.status });
        return [];
      }

      const payload = (await response.json()) as Record<string, { cik_str?: number; ticker?: string; title?: string }>;
      const rows = Object.values(payload)
        .filter((row) => Boolean(row.ticker))
        .map((row) => ({
          symbol: (row.ticker || "").toUpperCase(),
          exchange: "SEC",
          name: row.title || row.ticker || "",
          type: "stock",
          country: "US",
          currency: "USD",
          source: "sec",
          metadata: { cik: row.cik_str || 0, domain: "" },
        }));

      for (let i = 0; i < rows.length && i < DOMAIN_ENRICH_LIMIT; i += 1) {
        const cik = Number(rows[i]?.metadata?.cik || 0);
        if (!cik) continue;
        try {
          // eslint-disable-next-line no-await-in-loop
          const domain = await fetchSecDomain(cik);
          if (!domain) continue;
          const row = rows[i];
          if (!row) continue;
          row.metadata = { ...(row.metadata || {}), domain };
        } catch {
          // best-effort enrichment
        }
      }

      return rows;
    } catch (error) {
      logger.warn("sec_fetch_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  },
};
