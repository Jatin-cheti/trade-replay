import { logger } from "../../utils/logger";
import type { GlobalSymbolCandidate, GlobalSymbolProvider } from "../globalSymbolIngestion.service";
import { env } from "../../config/env";
import { SymbolModel } from "../../models/Symbol";
import { resolveTrustedDomainMultiSource } from "../domain-intelligence.service";

const OPENFIGI_URL = "https://api.openfigi.com/v3/mapping";
const REQUEST_BATCH = 100;
const DOMAIN_ENRICH_LIMIT = 120;

function toOpenFigiExchange(exchange: string): string {
  const upper = exchange.toUpperCase();
  if (upper === "NASDAQ" || upper === "NYSE") return "US";
  if (upper === "NSE" || upper === "BSE") return "IN";
  return upper.slice(0, 2);
}

function normalizeDomain(input: string): string {
  try {
    const parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function loadSeedSymbols(): Promise<Array<{ symbol: string; exchange: string }>> {
  const rows = await SymbolModel.find({
    type: "stock",
    exchange: { $in: ["NASDAQ", "NYSE", "NSE", "BSE", "SEC"] },
  })
    .sort({ searchFrequency: -1, userUsage: -1, priorityScore: -1 })
    .select({ symbol: 1, exchange: 1 })
    .limit(1500)
    .lean<Array<{ symbol: string; exchange: string }>>();

  const seen = new Set<string>();
  const seeds: Array<{ symbol: string; exchange: string }> = [];
  for (const row of rows) {
    const symbol = row.symbol.trim().toUpperCase();
    const exchange = row.exchange.trim().toUpperCase();
    if (!symbol || symbol.length > 12) continue;
    const key = `${exchange}:${symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    seeds.push({ symbol, exchange });
  }

  return seeds;
}

export const openfigiProvider: GlobalSymbolProvider = {
  name: "openfigi",
  fetchSymbols: async (): Promise<GlobalSymbolCandidate[]> => {
    if (!env.OPENFIGI_API_KEY) {
      logger.warn("openfigi_missing_key", { provider: "openfigi" });
      return [];
    }

    try {
      const seeds = await loadSeedSymbols();
      if (!seeds.length) return [];

      const allRows: GlobalSymbolCandidate[] = [];
      const pendingDomain: Array<{ index: number; symbol: string; name: string; exchange: string }> = [];

      for (let index = 0; index < seeds.length; index += REQUEST_BATCH) {
        const batch = seeds.slice(index, index + REQUEST_BATCH);
        const payload = batch.map((entry) => ({
          idType: "TICKER",
          idValue: entry.symbol,
          exchCode: toOpenFigiExchange(entry.exchange),
        }));

        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(OPENFIGI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-OPENFIGI-APIKEY": env.OPENFIGI_API_KEY,
            "User-Agent": "tradereplay-global-ingestion/1.0",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          logger.warn("openfigi_fetch_failed", { status: response.status });
          break;
        }

        // eslint-disable-next-line no-await-in-loop
        const mapped = (await response.json()) as Array<{
          data?: Array<{
            ticker?: string;
            name?: string;
            exchCode?: string;
            compositeFIGI?: string;
            securityType?: string;
          }>;
        }>;

        for (const group of mapped) {
          const first = group.data?.[0];
          if (!first?.ticker || !first?.name) continue;

          const candidate: GlobalSymbolCandidate = {
            symbol: first.ticker.toUpperCase(),
            exchange: (first.exchCode || "GLOBAL").toUpperCase(),
            name: first.name,
            type: "stock",
            country: "US",
            currency: "USD",
            source: "openfigi",
            metadata: {
              figi: first.compositeFIGI || "",
              securityType: first.securityType || "",
              domain: "",
            },
          };

          allRows.push(candidate);
          if (pendingDomain.length < DOMAIN_ENRICH_LIMIT) {
            pendingDomain.push({
              index: allRows.length - 1,
              symbol: candidate.symbol,
              name: candidate.name,
              exchange: candidate.exchange,
            });
          }
        }
      }

      for (const row of pendingDomain) {
        // eslint-disable-next-line no-await-in-loop
        const resolved = await resolveTrustedDomainMultiSource({
          symbol: row.symbol,
          companyName: row.name,
          exchange: row.exchange,
        });
        if (!resolved.domain) continue;

        const domain = normalizeDomain(resolved.domain);
        if (!domain) continue;
        const current = allRows[row.index];
        if (!current) continue;
        current.metadata = {
          ...(current.metadata || {}),
          domain,
          domainSource: resolved.source || "",
          domainConfidence: resolved.confidence,
        };
      }

      logger.info("openfigi_fetch_success", { provider: "openfigi", symbols: allRows.length });
      return allRows;
    } catch (error) {
      logger.warn("openfigi_fetch_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  },
};
