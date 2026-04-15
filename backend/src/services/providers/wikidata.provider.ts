import { logger } from "../../utils/logger";
import type { GlobalSymbolCandidate, GlobalSymbolProvider } from "../globalSymbolIngestion.service";

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const DEFAULT_LIMIT = 5000;
const MAX_PAGES = 20;

function buildQuery(limit: number, offset: number): string {
  return `SELECT ?symbol ?name ?exchangeCode ?countryCode ?website WHERE {
    ?item wdt:P31 wd:Q4830453 .
    ?item wdt:P249 ?symbol .
    OPTIONAL { ?item wdt:P2529 ?exchangeCode . }
    OPTIONAL { ?item wdt:P17 ?countryEntity . ?countryEntity wdt:P297 ?countryCode . }
    OPTIONAL { ?item rdfs:label ?name FILTER (lang(?name) = "en") }
    OPTIONAL { ?item wdt:P856 ?website . }
  } LIMIT ${limit} OFFSET ${offset}`;
}

function normalizeDomain(input?: string): string {
  if (!input) return "";
  try {
    const parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const wikidataProvider: GlobalSymbolProvider = {
  name: "wikidata",
  fetchSymbols: async (): Promise<GlobalSymbolCandidate[]> => {
    const allRows: GlobalSymbolCandidate[] = [];

    try {
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const limit = DEFAULT_LIMIT;
        const offset = page * limit;
        const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(buildQuery(limit, offset))}`;

        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": "tradereplay-global-ingestion/1.0" },
        });

        if (!response.ok) {
          logger.warn("wikidata_fetch_failed", { status: response.status, page, offset });
          break;
        }

        // eslint-disable-next-line no-await-in-loop
        const payload = (await response.json()) as {
          results?: {
            bindings?: Array<{
              symbol?: { value?: string };
              name?: { value?: string };
              exchangeCode?: { value?: string };
              countryCode?: { value?: string };
              website?: { value?: string };
            }>;
          };
        };

        const rows = payload.results?.bindings ?? [];
        if (rows.length === 0) break;

        allRows.push(
          ...rows
            .map((row) => ({
              symbol: row.symbol?.value || "",
              exchange: (row.exchangeCode?.value || "GLOBAL").toUpperCase(),
              name: row.name?.value || row.symbol?.value || "",
              type: "stock",
              country: (row.countryCode?.value || "GLOBAL").toUpperCase(),
              currency: "USD",
              source: "wikidata",
              metadata: {
                exchangeCode: row.exchangeCode?.value || "",
                domain: normalizeDomain(row.website?.value),
              },
            }))
            .filter((row) => row.symbol.length > 0),
        );

        if (rows.length < limit) break;
      }

      logger.info("wikidata_fetch_success", { symbols: allRows.length, maxPages: MAX_PAGES });
      return allRows;
    } catch (error) {
      logger.warn("wikidata_fetch_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  },
};
